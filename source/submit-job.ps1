# Submit JCL to TK5 via the sockdev card reader (port 3505) and retrieve the
# job output.
#
# Retrieval mode is chosen by the job's MSGCLASS:
#   MSGCLASS=H  -> REST mode (preferred): output stays on the JES2 spool,
#                  is fetched over HTTP from the HTTPD JES API (port 8080),
#                  then purged. No printers involved. Requires the HTTPD
#                  started task to be up.
#   MSGCLASS=Z  -> legacy sockdev mode: captures from the PRINTER2 socket
#                  printer on port 4000, managing $S/$P around the capture.
#   other       -> submit only, no capture.
#
# Usage:  .\submit-job.ps1 myjob.jcl
#         .\submit-job.ps1 myjob.jcl -OutFile result.txt
#         .\submit-job.ps1 myjob.jcl -KeepSpool   # don't purge after fetch
#         .\submit-job.ps1 myjob.jcl -NoCapture   # fire and forget
#
# Change the $MvsHost to match the IP address of your machine keeping quotes


param(
    [Parameter(Mandatory=$true)][string]$JclFile,
    [string]$MvsHost = "insert IP Address here",
    [int]$ReaderPort = 3505,
    [int]$PrinterPort = 4000,
    [int]$HttpPort = 8080,
    [string]$OutFile,
    [switch]$NoCapture,
    [switch]$KeepSpool,
    [int]$MaxWaitSeconds = 120,
    [int]$IdleSeconds = 5
)

if (-not (Test-Path $JclFile)) { throw "JCL file not found: $JclFile" }
$jcl = (Get-Content $JclFile -Raw) -replace "`r`n", "`n"
if (-not $jcl.EndsWith("`n")) { $jcl += "`n" }
if (-not $OutFile) { $OutFile = [IO.Path]::ChangeExtension($JclFile, ".out") }

$jobname = $null
if ($jcl -match '(?m)^//(\S{1,8})\s+JOB') { $jobname = $Matches[1] }

$mode = 'none'
if (-not $NoCapture) {
    if ($jcl -match 'MSGCLASS=H') { $mode = 'rest' }
    elseif ($jcl -match 'MSGCLASS=Z') { $mode = 'sockdev' }
    else { Write-Warning "No MSGCLASS=H/Z on job card - submitting without capture." }
}
if ($mode -eq 'rest' -and -not $jobname) {
    Write-Warning "Could not find jobname on job card - submitting without capture."
    $mode = 'none'
}

function Invoke-Oper($cmd) {
    $enc = [Uri]::EscapeDataString($cmd)
    & curl.exe -s -m 10 "http://${MvsHost}:8038/cgi-bin/tasks/syslog?command=$enc" | Out-Null
}

function Get-JesJobs($name) {
    $raw = & curl.exe -s -m 10 "http://${MvsHost}:${HttpPort}/jes/status?job=$name" | Out-String
    try { @((ConvertFrom-Json $raw).data) } catch { @() }
}

# ---- remember pre-existing jobs with this jobname (REST mode) ----
$before = @()
if ($mode -eq 'rest') {
    $before = @(Get-JesJobs $jobname | ForEach-Object { $_.jobid })
}

# ---- legacy sockdev: connect and ready the printer BEFORE submitting ----
$prt = $null
if ($mode -eq 'sockdev') {
    $prt = New-Object System.Net.Sockets.TcpClient($MvsHost, $PrinterPort)
    $prtStream = $prt.GetStream()
    Invoke-Oper '/$S PRINTER2'
    Start-Sleep -Milliseconds 800
    Invoke-Oper '/$S PRINTER2'
    Invoke-Oper 'i 000F'
}

# ---- submit through the card reader ----
$rdr = New-Object System.Net.Sockets.TcpClient($MvsHost, $ReaderPort)
$rdrStream = $rdr.GetStream()
$bytes = [Text.Encoding]::ASCII.GetBytes($jcl)
$rdrStream.Write($bytes, 0, $bytes.Length)
$rdrStream.Close(); $rdr.Close()
Write-Host "Job submitted to ${MvsHost}:$ReaderPort"

# ---- REST retrieval ----
if ($mode -eq 'rest') {
    $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
    $target = $null
    $sawActive = $false
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 1
        $jobs = @(Get-JesJobs $jobname | Where-Object { $before -notcontains $_.jobid })
        $done = $jobs | Where-Object { $_.status -eq 'OUTPUT' } | Select-Object -First 1
        if ($done) { $target = $done; break }
        if ($jobs | Where-Object { $_.status -eq 'ACTIVE' }) { $sawActive = $true }
    }
    if (-not $target) {
        if ($sawActive) {
            Write-Warning "Job $jobname is still executing after $MaxWaitSeconds seconds (waiting on a dataset?). Check with: .\oper.ps1 '/`$DA'"
        } else {
            Write-Warning "Job $jobname never appeared on the output queue. Check with: .\oper.ps1 '/`$DA'"
        }
        return
    }
    $jobid = $target.jobid
    $text = & curl.exe -s -m 30 "http://${MvsHost}:${HttpPort}/jes/print?jobid=$jobid" | Out-String
    if ($text.Trim().Length -eq 0) {
        Write-Warning "Empty output returned for $jobid"
        return
    }
    $text | Set-Content $OutFile -Encoding ascii
    Write-Host "Output of $jobname ($jobid) saved to $OutFile ($($text.Length) bytes)"
    if (-not $KeepSpool) {
        $r = & curl.exe -s -m 10 -X POST -d "jobname=$jobname&jobid=$jobid" "http://${MvsHost}:${HttpPort}/jes/purge" | Out-String
        if ($r -match 'rc=0') { Write-Host "Spool output purged." }
        else { Write-Warning "Purge may have failed: $($r.Trim())" }
    }
    return
}

# ---- legacy sockdev capture ----
if ($mode -eq 'sockdev') {
    $sb = New-Object System.Text.StringBuilder
    $buf = New-Object byte[] 4096
    $gotData = $false
    $lastData = Get-Date
    $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)

    while ((Get-Date) -lt $deadline) {
        if ($prtStream.DataAvailable) {
            $n = $prtStream.Read($buf, 0, $buf.Length)
            if ($n -gt 0) {
                [void]$sb.Append([Text.Encoding]::ASCII.GetString($buf, 0, $n))
                $gotData = $true
                $lastData = Get-Date
            }
        } else {
            if ($gotData -and ((Get-Date) - $lastData).TotalSeconds -gt $IdleSeconds) { break }
            Start-Sleep -Milliseconds 200
        }
    }
    # drain the printer and keep reading until the drain completes; closing
    # the socket mid-write leaves the device in INT REQ
    Invoke-Oper '/$P PRINTER2'
    $flushEnd = (Get-Date).AddSeconds(15)
    $lastData = Get-Date
    while ((Get-Date) -lt $flushEnd) {
        if ($prtStream.DataAvailable) {
            $n = $prtStream.Read($buf, 0, $buf.Length)
            if ($n -gt 0) {
                [void]$sb.Append([Text.Encoding]::ASCII.GetString($buf, 0, $n))
                $lastData = Get-Date
            }
        } else {
            if (((Get-Date) - $lastData).TotalSeconds -gt 4) { break }
            Start-Sleep -Milliseconds 200
        }
    }
    $prt.Close()

    if ($gotData) {
        $sb.ToString() | Set-Content $OutFile -Encoding ascii
        Write-Host "Output saved to $OutFile ($($sb.Length) bytes)"
    } else {
        Write-Warning "No output received within $MaxWaitSeconds seconds. Check job status with: .\oper.ps1 '/`$DA'"
    }
}
