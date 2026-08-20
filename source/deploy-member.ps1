# Deploy a local text file into a PDS member on TK5 via an IEBUPDTE job,
# submitted through the card reader and confirmed over the JES REST API.
# Change the $MvsHost to match the IP address of your machine
#
# Usage:  .\deploy-member.ps1 <localfile> <DSN> <MEMBER>
#   e.g.  .\deploy-member.ps1 webadm.rexx HTTPD.BREXX WEBADM

param(
    [Parameter(Mandatory=$true)][string]$LocalFile,
    [Parameter(Mandatory=$true)][string]$Dsn,
    [Parameter(Mandatory=$true)][string]$Member,
    [string]$MvsHost = "insert IP Address here",
    [string]$User = "HERC01",      # HERC01 is in RAKF group ADMIN (ALTER on *)
    [string]$Password = "CUL8TR"
)

if (-not (Test-Path $LocalFile)) { throw "File not found: $LocalFile" }
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Get-Content $LocalFile

# expand tabs, check width
$clean = foreach ($line in $src) {
    $l = $line
    while ($l -match "`t") {
        $i = $l.IndexOf("`t")
        $l = $l.Substring(0, $i) + (' ' * (8 - ($i % 8))) + $l.Substring($i + 1)
    }
    if ($l.Length -gt 80) { Write-Warning "line >80 cols will be truncated by the card reader: $l" }
    $l
}

# IEBGENER copies instream card images straight into the target member.
# DISP=SHR lets it coexist with a task (e.g. HTTPD) holding the PDS, and it
# writes correctly regardless of the library's RECFM (HTTPD.BREXX is VB/255,
# which IEBUPDTE's fixed-80 assumption cannot open -> IEB814I).
$tmp = Join-Path $env:TEMP "deploy_$Member.jcl"
$jcl = @()
$jcl += "//HERC01DP JOB (DEPLOY),'DEPLOY $Member',CLASS=A,MSGCLASS=H,"
$jcl += "//         USER=$User,PASSWORD=$Password"
$jcl += "//GEN      EXEC PGM=IEBGENER"
$jcl += "//SYSPRINT DD SYSOUT=*"
$jcl += "//SYSIN    DD DUMMY"
$jcl += "//SYSUT2   DD DSN=$Dsn($Member),DISP=SHR"
$jcl += "//SYSUT1   DD DATA,DLM='##'"
$jcl += $clean
$jcl += "##"
$jcl -join "`r`n" | Set-Content $tmp -Encoding ascii

$outFile = Join-Path $env:TEMP "deploy_$Member.out"
& (Join-Path $toolsDir "submit-job.ps1") $tmp -MvsHost $MvsHost -OutFile $outFile | Out-Null

if (Test-Path $outFile) {
    $o = Get-Content $outFile
    $genOk = $o | Where-Object { $_ -match 'IEB1035I|PROCESSING ENDED' } | Select-Object -First 1
    if (($o -match 'IEBGENER\s+RC=\s*0000' -or $genOk) -and ($o -notmatch 'CANNOT BE OPENED|ABEND')) {
        Write-Host "Deployed $Dsn($Member): OK" -ForegroundColor Green
    } else {
        Write-Warning "Deploy of $Dsn($Member) may have failed - see $outFile"
        $o | Where-Object { $_ -match 'IEB\d|ABEND|NOT |RC=' } | Select-Object -First 8 |
            ForEach-Object { Write-Host "  $($_.Trim())" }
    }
} else {
    Write-Warning "No output captured for deploy job."
}
