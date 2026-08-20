# Assemble, link, and run an IFOX00 assembler source file on TK5 (MVS 3.8).
#
# Usage:  .\asm.ps1 hello.asm           - assemble, link, go; show output
#         .\asm.ps1 hello.asm -Full     - also dump the entire job listing
#
# Uses the stock ASMFCLG proc. WTO output and anything the program writes
# to SYSPRINT are shown. Full listing kept in <name>.out.
# NOTE: assembler is column-sensitive - labels in col 1, continuations
# need col 72. Lines over 80 columns are truncated by the card reader.

param(
    [Parameter(Mandatory=$true)][string]$SourceFile,
    [switch]$Full,
    [string]$MvsHost = "insert IP Address here"
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

$progName = [IO.Path]::GetFileName($SourceFile).ToUpper() -replace "[^A-Z0-9. ]", ""
if ($progName.Length -gt 18) { $progName = $progName.Substring(0, 18) }

$jcl = @()
$jcl += "//HERC01A  JOB (ASM),'$progName',CLASS=A,MSGCLASS=H,REGION=2048K,"
$jcl += "//         USER=HERC01,PASSWORD=CUL8TR"
$jcl += "//S1       EXEC ASMFCLG"
$jcl += "//ASM.SYSPRINT DD SYSOUT=*"
$jcl += "//ASM.SYSPUNCH DD DUMMY"
$jcl += "//ASM.SYSIN DD DATA,DLM='##'"
$jcl += $clean
$jcl += "##"
$jcl += "//LKED.SYSPRINT DD SYSOUT=*"
$jcl += "//GO.SYSPRINT DD SYSOUT=*"
$jcl += "//GO.SYSTERM  DD SYSOUT=*"
$jcl -join "`r`n" | Set-Content $jclFile -Encoding ascii

& (Join-Path $toolsDir "submit-job.ps1") $jclFile -MvsHost $MvsHost -OutFile $outFile
if (-not (Test-Path $outFile)) { throw "No output captured - check job status with oper.ps1 '/`$DA'" }
$out = Get-Content $outFile

Write-Host ""
Write-Host "Step results:" -ForegroundColor Cyan
$steps = $out | Where-Object { $_ -match 'JOB\s+\d+\s+HERC01A\s+\S+\s+\S+\s+\S+\s+(RC=|AB |\*FLUSH\*)' }
$goRC = $null
foreach ($s in $steps) {
    Write-Host ($s -replace '^\s*[\d.]+\s+JOB\s+\d+\s+', '  ')
    if ($s -match '\sGO\s+\S+\s+RC=\s*(\d+)') { $goRC = [int]$Matches[1] }
}

if ($goRC -ne $null) {
    Write-Host ""
    Write-Host "Program output (GO step RC=$goRC):" -ForegroundColor Green
    # WTO messages appear in the JES2 job log prefixed with +
    $wto = $out | Where-Object { $_ -match '^\s*[\d.]+\s+JOB\s+\d+\s+\+' }
    foreach ($w in $wto) { Write-Host ("  " + ($w -replace '^\s*[\d.]+\s+JOB\s+\d+\s+\+', '')) }
    # Anything written to GO SYSPRINT sits between the LKED map and the END banner
    $auth = ($out | Select-String 'AUTHORIZATION CODE IS' | Select-Object -Last 1).LineNumber
    $endB = ($out | Select-String '^\*\*\*\*Z   END' |
        Where-Object { $_.LineNumber -gt $auth } | Select-Object -First 1).LineNumber
    if ($auth -and -not $endB) { $endB = $out.Count + 1 }
    if ($auth -and $endB -and $endB -gt $auth) {
        foreach ($raw in $out[$auth..($endB - 2)]) {
            $t = $raw.TrimEnd("`r", ' ')
            if ($t -cmatch '^\s*[A-Z0-9 ]+$' -and $t.Length -ge 90) { break }
            if ($t.Trim() -ne '' -and $t -notmatch '^(- )+-?\s*$') { Write-Host "  $t" }
        }
    }
} else {
    Write-Host ""
    Write-Host "Job did not run to completion. Diagnostics:" -ForegroundColor Yellow
    $out | Where-Object { $_ -match 'IFO\d|IEW\d|ABEND|FLAGGED|IEF202I' } |
        Select-Object -First 25 | ForEach-Object { Write-Host "  $($_.TrimEnd())" }
}
Write-Host ""
Write-Host "Full listing: $outFile"
if ($Full) { $out }
