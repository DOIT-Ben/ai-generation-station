param(
    [int]$Port = 18791,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-server-common.ps1')

$status = Get-AigsServerStatus -Port $Port
$payload = [pscustomobject]@{
    port = $status.Port
    url = $status.Url
    healthUrl = $status.HealthUrl
    healthy = $status.Healthy
    statusCode = $status.StatusCode
    managedPid = $status.ManagedPid
    listenerPid = $status.ListenerPid
    pidFile = $status.PidFile
    stdoutLog = $status.StdoutLog
    stderrLog = $status.StderrLog
    healthError = $status.HealthError
}

if ($Json) {
    $payload | ConvertTo-Json -Depth 4
} else {
    Write-Output "URL:        $($payload.url)"
    Write-Output "Health URL: $($payload.healthUrl)"
    Write-Output "Healthy:    $($payload.healthy)"
    Write-Output "HTTP code:  $($payload.statusCode)"
    Write-Output "Managed PID:$($payload.managedPid)"
    Write-Output "Listener PID:$($payload.listenerPid)"
    Write-Output "PID file:   $($payload.pidFile)"
    Write-Output "stdout log: $($payload.stdoutLog)"
    Write-Output "stderr log: $($payload.stderrLog)"
    if ($payload.healthError) {
        Write-Output "Health err: $($payload.healthError)"
    }
}

if ($status.Healthy -and $status.ProcessFound) {
    exit 0
}

if ($status.Healthy -and -not $status.ProcessFound) {
    exit 2
}

exit 1
