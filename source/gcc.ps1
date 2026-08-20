# Compile, link, and run a C source file on the TK5 mainframe (MVS 3.8).
#
# Usage:  .\gcc.ps1 hello.c            - compile and run, show program output
#         .\gcc.ps1 hello.c -Full      - also dump the entire job listing
#
# Wraps the source in JCL using the shipped SYS2.PROCLIB(GCCCLG) proc,
# submits via the sockdev reader (3505), captures class-Z output (4000),
# and shows step return codes plus the program's stdout.
# Full listing is kept in <name>.out, generated JCL in <name>.jcl.
#
# Change the $MvsHost to match the IP address of your machine keeping quotes

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

# Prepare source: expand tabs, check card-image limits
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
if ($bad -gt 0) { Write-Warning "$bad line(s) longer than 80 columns will be truncated by the card reader." }

$progName = [IO.Path]::GetFileName($SourceFile).ToUpper() -replace "[^A-Z0-9. ]", ""
if ($progName.Length -gt 18) { $progName = $progName.Substring(0, 18) }

$jcl = @()
$jcl += "//HERC01C  JOB (GCC),'$progName',CLASS=A,MSGCLASS=H,REGION=4096K,"
$jcl += "//         USER=HERC01,PASSWORD=CUL8TR"
$jcl += "//S1       EXEC GCCCLG"
$jcl += "//COMP.SYSIN DD DATA,DLM='##'"
$jcl += $clean
$jcl += "##"
$jcl -join "`r`n" | Set-Content $jclFile -Encoding ascii

& (Join-Path $toolsDir "submit-job.ps1") $jclFile -MvsHost $MvsHost -OutFile $outFile
if (-not (Test-Path $outFile)) { throw "No output captured - check job status with oper.ps1 '/`$DA'" }
$out = Get-Content $outFile

# Step return codes from the IEFACTRT table
Write-Host ""
Write-Host "Step results:" -ForegroundColor Cyan
$steps = $out | Where-Object { $_ -match 'JOB\s+\d+\s+HERC01C\s+\S+\s+\S+\s+\S+\s+(RC=|AB |\*FLUSH\*)' }
$goRC = $null
foreach ($s in $steps) {
    $t = ($s -replace '^\s*[\d.]+\s+JOB\s+\d+\s+', '  ')
    Write-Host $t
    if ($s -match '\sGO\s+\S+\s+RC=\s*(\d+)') { $goRC = [int]$Matches[1] }
}

if ($goRC -eq 0) {
    # Program stdout: between the linkage editor's last line and the END banner,
    # skipping banner block-art (very wide, uppercase-only lines)
    $auth = ($out | Select-String 'AUTHORIZATION CODE IS' | Select-Object -Last 1).LineNumber
    $endB = ($out | Select-String '^\*\*\*\*Z   END' |
        Where-Object { $_.LineNumber -gt $auth } | Select-Object -First 1).LineNumber
    if ($auth -and -not $endB) { $endB = $out.Count + 1 }
    Write-Host ""
    Write-Host "Program output:" -ForegroundColor Green
    if ($auth -and $endB -and $endB -gt $auth) {
        foreach ($raw in $out[$auth..($endB - 2)]) {
            $t = $raw.TrimEnd("`r", ' ')
            # banner block-art = very wide uppercase-only line; stop there
            if ($t -cmatch '^\s*[A-Z0-9 ]+$' -and $t.Length -ge 90) { break }
            if ($t.Trim() -ne '' -and $t -notmatch '^(- )+-?\s*$') { Write-Host "  $t" }
        }
    } else {
        Write-Host "  (could not isolate GO step output - see $outFile)"
    }
} else {
    Write-Host ""
    Write-Host "Job did not run to completion. Diagnostics:" -ForegroundColor Yellow
    $out | Where-Object {
        $_ -match '<stdin>:|IFO\d|IEW\d|ABEND|IEF202I|\berror\b|\bwarning\b' -and
        $_ -notmatch 'pedantic|SUBSTITUTION|COS1='
    } | Select-Object -First 25 | ForEach-Object { Write-Host "  $($_.TrimEnd())" }
}
Write-Host ""
Write-Host "Full listing: $outFile"
if ($Full) { $out }
