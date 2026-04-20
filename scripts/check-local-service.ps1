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
    authContractUrl = $status.AuthContractUrl
    healthy = $status.Healthy
    statusCode = $status.StatusCode
    apiHealthy = $status.ApiHealthy
    apiStatusCode = $status.ApiStatusCode
    authContractHealthy = $status.AuthContractHealthy
    authContractStatusCode = $status.AuthContractStatusCode
    managedPid = $status.ManagedPid
    listenerPid = $status.ListenerPid
    pidFile = $status.PidFile
    stdoutLog = $status.StdoutLog
    stderrLog = $status.StderrLog
    healthError = $status.HealthError
    authContractError = $status.AuthContractError
}

if ($Json) {
    $payload | ConvertTo-Json -Depth 4
} else {
    Write-Output "URL:        $($payload.url)"
    Write-Output "Health URL: $($payload.healthUrl)"
    Write-Output "Auth URL:   $($payload.authContractUrl)"
    Write-Output "Healthy:    $($payload.healthy)"
    Write-Output "API ready:  $($payload.apiHealthy)"
    Write-Output "API code:   $($payload.apiStatusCode)"
    Write-Output "Auth ready: $($payload.authContractHealthy)"
    Write-Output "Auth code:  $($payload.authContractStatusCode)"
    Write-Output "Managed PID:$($payload.managedPid)"
    Write-Output "Listener PID:$($payload.listenerPid)"
    Write-Output "PID file:   $($payload.pidFile)"
    Write-Output "stdout log: $($payload.stdoutLog)"
    Write-Output "stderr log: $($payload.stderrLog)"
    if ($payload.healthError) {
        Write-Output "Health err: $($payload.healthError)"
    }
    if ($payload.authContractError) {
        Write-Output "Auth err:   $($payload.authContractError)"
    }
}

if ($status.Healthy -and $status.ProcessFound) {
    exit 0
}

if ($status.Healthy -and -not $status.ProcessFound) {
    exit 2
}

exit 1
