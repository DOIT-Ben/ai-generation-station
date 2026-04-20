param(
    [int]$Port = 18791,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'local-server-common.ps1')

$paths = Ensure-AigsRuntimeDir -Port $Port
$status = Get-AigsServerStatus -Port $Port

if ($status.ProcessFound -and $status.Healthy -and -not $Restart) {
    Write-Output "AI-Generation-Stations is already running at $($status.Url) (PID $($status.ManagedPid))."
    Write-Output "PID file: $($status.PidFile)"
    Write-Output "stdout:   $($status.StdoutLog)"
    Write-Output "stderr:   $($status.StderrLog)"
    exit 0
}

if ($status.ListenerPid -and -not $status.ProcessFound) {
    throw "Port $Port is already occupied by PID $($status.ListenerPid), but it is not recognized as the managed repo server. Refusing to launch a duplicate."
}

if ($status.ProcessFound -and $Restart) {
    Stop-AigsManagedProcess -Port $Port -Force | Out-Null
}

$command = New-AigsLaunchCommand -Port $Port
$process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WorkingDirectory $repoRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $paths.StdoutLog `
    -RedirectStandardError $paths.StderrLog `
    -PassThru

$health = Wait-AigsHealth -Port $Port -TimeoutSec 20
if (-not $health.Healthy) {
    try {
        Stop-AigsManagedProcess -Port $Port -Force | Out-Null
    } catch {
        # Ignore stop cleanup failures and report the startup failure.
    }
    try {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    } catch {
        # Ignore wrapper cleanup failures.
    }
    throw "Local service failed to become healthy on $($paths.HealthUrl). Check $($paths.StdoutLog) and $($paths.StderrLog)."
}

$finalStatus = Get-AigsServerStatus -Port $Port
Write-Output "Started AI-Generation-Stations at $($finalStatus.Url) (PID $($finalStatus.ManagedPid))."
Write-Output "PID file: $($finalStatus.PidFile)"
Write-Output "stdout:   $($finalStatus.StdoutLog)"
Write-Output "stderr:   $($finalStatus.StderrLog)"
