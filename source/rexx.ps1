# Run a REXX script on TK5 (MVS 3.8) under BREXX V2R5M3.
#
# Usage:  .\rexx.ps1 hello.rexx          - run, show SAY output
#         .\rexx.ps1 hello.rexx -Full    - also dump the entire job listing
#
# Writes the script to HERC01.RXBATCH.EXEC(RXTEMP), then runs it with the
# BREXX RXBATCH proc. Full listing kept in <name>.out.
# (Uses a dedicated library - HERC01.EXEC is held by any active TSO logon,
# which would make the batch job wait forever on the enqueue.)

param(
    [Parameter(Mandatory=$true)][string]$SourceFile,
    [switch]$Full,
    [string]$MvsHost = "192.168.1.XXX"
)

if (-not (Test-Path $SourceFile)) { throw "Source file not found: $SourceFile" }
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$base = [IO.Path]::Combine((Split-Path -Resolve $SourceFile -Parent), [IO.Path]::GetFileNameWithoutExtension($SourceFile))
$jclFile = "$base.jcl"
$outFile = "$base.out"

$src = Get-Content $SourceFile
$clean = @()
$bad = 0
foreach ($line in $src) {
    $l = $line
    while ($l -match "`t") {
        $i = $l.IndexOf("`t")
        $l = $l.Substring(0, $i) + (' ' * (8 - ($i % 8))) + $l.Substring($i + 1)
    }
    if ($l.Length -gt 80) { $bad++ }
    if ($l -match '^##') { throw "Source line starts with '##' (the JCL delimiter): $l" }
    $clean += $l
}
if ($bad -gt 0) { Write-Warning "$bad line(s) longer than 80 columns will be truncated." }
if ($clean.Count -eq 0 -or $clean[0] -notmatch '/\*') {
    Write-Warning "First line should be a /* REXX */ comment."
}

$progName = [IO.Path]::GetFileName($SourceFile).ToUpper() -replace "[^A-Z0-9. ]", ""
if ($progName.Length -gt 18) { $progName = $progName.Substring(0, 18) }

$jcl = @()
$jcl += "//HERC01R  JOB (REXX),'$progName',CLASS=A,MSGCLASS=H,REGION=8192K,"
$jcl += "//         USER=HERC01,PASSWORD=CUL8TR"
$jcl += "//* WRITE SCRIPT TO TEMP MEMBER, THEN RUN IT WITH BREXX"
$jcl += "//WRITE    EXEC PGM=IEBGENER"
$jcl += "//SYSPRINT DD DUMMY"
$jcl += "//SYSIN    DD DUMMY"
$jcl += "//SYSUT2   DD DSN=HERC01.RXBATCH.EXEC(RXTEMP),DISP=OLD"
$jcl += "//SYSUT1   DD DATA,DLM='##'"
$jcl += $clean
$jcl += "##"
$jcl += "//REXX     EXEC RXBATCH,BREXX='BREXX',"
$jcl += "//         EXEC='RXTEMP',"
$jcl += "//         SLIB='HERC01.RXBATCH.EXEC'"
$jcl -join "`r`n" | Set-Content $jclFile -Encoding ascii

& (Join-Path $toolsDir "submit-job.ps1") $jclFile -MvsHost $MvsHost -OutFile $outFile
if (-not (Test-Path $outFile)) { throw "No output captured - check job status with oper.ps1 '/`$DA'" }
$out = Get-Content $outFile

Write-Host ""
Write-Host "Step results:" -ForegroundColor Cyan
$steps = $out | Where-Object { $_ -match 'JOB\s+\d+\s+HERC01R\s+\S+(\s+\S+){1,2}\s+(RC=|AB |\*FLUSH\*)' }
$ok = $false
foreach ($s in $steps) {
    Write-Host ($s -replace '^\s*[\d.]+\s+JOB\s+\d+\s+', '  ')
    if ($s -match '\sREXX\s+\S+\s+\S+\s+RC=\s*\d+') { $ok = $true }
}

if ($ok) {
    # SAY output goes to the BREXX step's STDOUT sysout, which is the last
    # SYSOUT section before the trailing END banner
    $last = ($out | Select-String 'IEF376I' | Select-Object -Last 1).LineNumber
    $endB = ($out | Select-String '^\*\*\*\*Z   END' |
        Where-Object { $_.LineNumber -gt $last } | Select-Object -First 1).LineNumber
    if ($last -and -not $endB) { $endB = $out.Count + 1 }
    Write-Host ""
    Write-Host "Script output:" -ForegroundColor Green
    if ($endB -and $last -and $endB -gt $last) {
        foreach ($raw in $out[$last..($endB - 2)]) {
            $t = $raw.TrimEnd("`r", ' ')
            if ($t -cmatch '^\s*[A-Z0-9 ]+$' -and $t.Length -ge 90) { break }
            if ($t.Trim() -ne '' -and $t -notmatch '^(- )+-?\s*$') { Write-Host "  $t" }
        }
    } else {
        Write-Host "  (could not isolate output - see $outFile)"
    }
} else {
    Write-Host ""
    Write-Host "Job did not run to completion. Diagnostics:" -ForegroundColor Yellow
    $out | Where-Object { $_ -match 'ABEND|ERROR|IEF202I|NOT FOUND|IEB\d|\+\d+ ' } |
        Select-Object -First 25 | ForEach-Object { Write-Host "  $($_.TrimEnd())" }
}
Write-Host ""
Write-Host "Full listing: $outFile"
if ($Full) { $out }
