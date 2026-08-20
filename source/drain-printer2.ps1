# Drain any output stuck on PRINTER2 (device 00F, the class-Z sockdev printer).
#
# Why this exists: PRINTER2 is a socket printer that normally stays DRAINED, so
# anything routed to JES2 class Z (some system STCs like SHUTDOWN, plus legacy
# MSGCLASS=Z jobs) queues on it and just sits there. The web console's Purge
# button calls HTTPJES2, which CANNOT remove output that is *assigned to a
# printer device* - it reports success but the output stays. Printing it is what
# actually clears it (the output's disposition is PURGE), which is what this does:
# connect a listener, start PRINTER2, let it print+purge, then drain it again.
#
# Change the $MvsHost to match the IP address of your machine keeping quotes
#
# Usage:  .\drain-printer2.ps1            # clear the backlog, discard it
#         .\drain-printer2.ps1 -Save x.txt   # also save what was printed

param(
    [string]$MvsHost = "insert IP Address here",
    [int]$Port = 4000,
    [string]$Save,
    [int]$IdleSeconds = 6,
    [int]$MaxSeconds = 60
)

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
function Oper($c){ & (Join-Path $toolsDir "oper.ps1") $c -TailLines 2 | Out-Null }

$c = New-Object System.Net.Sockets.TcpClient($MvsHost, $Port)
$s = $c.GetStream()
Oper '/$S PRINTER2'
Start-Sleep -Milliseconds 800
Oper '/$S PRINTER2'          # 2nd start answers a $HASP190 SETUP prompt if present
Oper 'i 000F'                # clear any pending intervention-required

$sb = New-Object System.Text.StringBuilder
$buf = New-Object byte[] 8192
$tot = 0; $got = $false; $last = Get-Date
$deadline = (Get-Date).AddSeconds($MaxSeconds)
while ((Get-Date) -lt $deadline) {
    if ($s.DataAvailable) {
        $n = $s.Read($buf, 0, $buf.Length)
        if ($n -gt 0) { $tot += $n; $got = $true; $last = Get-Date
            if ($Save) { [void]$sb.Append([Text.Encoding]::ASCII.GetString($buf,0,$n)) } }
    } else {
        if ($got -and ((Get-Date) - $last).TotalSeconds -gt $IdleSeconds) { break }
        Start-Sleep -Milliseconds 250
    }
}
Oper '/$P PRINTER2'          # leave it DRAINED again
$c.Close()

if ($Save -and $sb.Length) { $sb.ToString() | Set-Content $Save -Encoding ascii; Write-Host "Saved to $Save" }
if ($got) { Write-Host "Drained $tot bytes from PRINTER2 - class-Z backlog cleared." }
else      { Write-Host "Nothing queued on PRINTER2." }
