# Issue a Hercules or MVS operator command via the TK5 web console (port 8038)
# and show the tail of the syslog.
#
# MVS/JES2 commands need the "/" prefix (quote them so PS doesn't eat $):
#   .\oper.ps1 '/$DA'          - display active jobs
#   .\oper.ps1 '/$DU,PRT'      - display printers
#   .\oper.ps1 '/$P PRINTER1'  - drain printer 1 (output then stays on spool)
#   .\oper.ps1 '/$S PRINTER1'  - start printer 1
#   .\oper.ps1 'devlist PRT'   - Hercules command (no prefix)
#
# Uses curl.exe because the Hercules HTTP server predates strict HTTP/1.1
# and .NET WebClient rejects its response headers.
#
# Change the $MvsHost to match the IP address of your machine keeping quotes


param(
    [Parameter(Mandatory=$true)][string]$Command,
    [string]$MvsHost = "insert IP address here",
    [int]$Port = 8038,
    [int]$TailLines = 25
)

$enc = [Uri]::EscapeDataString($Command)
$html = & curl.exe -s -m 10 "http://${MvsHost}:${Port}/cgi-bin/tasks/syslog?command=$enc" | Out-String
$text = $html -replace "`0", '' -replace '<[^>]*>', '' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&amp;', '&'
($text -split "`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -Last $TailLines) -join "`n"
