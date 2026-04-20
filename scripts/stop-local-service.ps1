param(
    [int]$Port = 18791
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-server-common.ps1')

$status = Get-AigsServerStatus -Port $Port
if (-not $status.ProcessFound) {
    if ($status.ListenerPid) {
        throw "Port $Port is in use by PID $($status.ListenerPid), but it is not recognized as the managed repo server. Refusing to stop an unknown process."
    }
    Remove-AigsPid -Port $Port
    Write-Output "No managed AI-Generation-Stations process is running on port $Port."
    exit 0
}

Stop-AigsManagedProcess -Port $Port -Force | Out-Null
$after = Get-AigsServerStatus -Port $Port
if ($after.ProcessFound -or $after.Healthy) {
    throw "Managed process stop was requested, but port $Port still looks active. Check $($after.StdoutLog) and $($after.StderrLog)."
}

Write-Output "Stopped AI-Generation-Stations on port $Port."
