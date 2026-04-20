$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:ProfilePath = 'D:\document\PowerShell\profile.ps1'
$script:ServerEntry = Join-Path $script:RepoRoot 'server\index.js'
$script:HealthPath = '/api/health'
$script:AuthContractPath = '/api/auth/csrf'

function Get-AigsRuntimePaths {
    param(
        [int]$Port = 18791
    )

    $runtimeDir = Join-Path $script:RepoRoot 'output\runtime'
    [pscustomobject]@{
        RuntimeDir = $runtimeDir
        PidFile = Join-Path $runtimeDir "local-server-$Port.pid"
        StdoutLog = Join-Path $runtimeDir "local-server-$Port.stdout.log"
        StderrLog = Join-Path $runtimeDir "local-server-$Port.stderr.log"
        Url = "http://127.0.0.1:$Port/"
        HealthUrl = "http://127.0.0.1:$Port$script:HealthPath"
        AuthContractUrl = "http://127.0.0.1:$Port$script:AuthContractPath"
    }
}

function Ensure-AigsRuntimeDir {
    param(
        [int]$Port = 18791
    )

    $paths = Get-AigsRuntimePaths -Port $Port
    if (-not (Test-Path $paths.RuntimeDir)) {
        New-Item -ItemType Directory -Path $paths.RuntimeDir -Force | Out-Null
    }
    return $paths
}

function Read-AigsPid {
    param(
        [int]$Port = 18791
    )

    $pidFile = (Get-AigsRuntimePaths -Port $Port).PidFile
    if (-not (Test-Path $pidFile)) {
        return $null
    }

    $raw = (Get-Content -Raw $pidFile -ErrorAction SilentlyContinue).Trim()
    if (-not $raw) {
        return $null
    }

    $parsedPid = 0
    if ([int]::TryParse($raw, [ref]$parsedPid)) {
        return $parsedPid
    }
    return $null
}

function Write-AigsPid {
    param(
        [int]$Port = 18791,
        [Parameter(Mandatory = $true)]
        [int]$ProcessId
    )

    $paths = Ensure-AigsRuntimeDir -Port $Port
    Set-Content -LiteralPath $paths.PidFile -Value $ProcessId -NoNewline
}

function Remove-AigsPid {
    param(
        [int]$Port = 18791
    )

    $pidFile = (Get-AigsRuntimePaths -Port $Port).PidFile
    if (Test-Path $pidFile) {
        Remove-Item -LiteralPath $pidFile -Force
    }
}

function Get-AigsProcessById {
    param(
        [Nullable[int]]$ProcessId
    )

    if (-not $ProcessId) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if (-not $process) {
        return $null
    }

    $commandLine = if ($process.CommandLine) { [string]$process.CommandLine } else { '' }
    if (
        $commandLine -notlike "*$script:ServerEntry*" -and
        $commandLine -notmatch '(^|["\s])server[\\/]+index\.js(["\s]|$)'
    ) {
        return $null
    }

    return $process
}

function Get-AigsListenerPid {
    param(
        [int]$Port = 18791
    )

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $listener) {
        return $null
    }

    return [int]$listener.OwningProcess
}

function Invoke-AigsHealthCheck {
    param(
        [int]$Port = 18791,
        [int]$TimeoutSec = 5
    )

    $paths = Get-AigsRuntimePaths -Port $Port
    try {
        $response = Invoke-WebRequest -Uri $paths.HealthUrl -UseBasicParsing -TimeoutSec $TimeoutSec
        return [pscustomobject]@{
            Healthy = ([int]$response.StatusCode -eq 200)
            StatusCode = [int]$response.StatusCode
            Error = $null
            Url = $paths.HealthUrl
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return [pscustomobject]@{
            Healthy = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
            Url = $paths.HealthUrl
        }
    }
}

function Wait-AigsHealth {
    param(
        [int]$Port = 18791,
        [int]$TimeoutSec = 20,
        [int]$PollMs = 500
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $lastHealth = $null
    do {
        $lastHealth = Invoke-AigsHealthCheck -Port $Port -TimeoutSec 5
        if ($lastHealth.Healthy) {
            return $lastHealth
        }
        Start-Sleep -Milliseconds $PollMs
    } while ((Get-Date) -lt $deadline)

    return $lastHealth
}

function Invoke-AigsAuthContractCheck {
    param(
        [int]$Port = 18791,
        [int]$TimeoutSec = 5
    )

    $paths = Get-AigsRuntimePaths -Port $Port
    try {
        $response = Invoke-WebRequest -Uri $paths.AuthContractUrl -UseBasicParsing -TimeoutSec $TimeoutSec
        $statusCode = [int]$response.StatusCode
        $payload = $null
        $parseError = $null

        try {
            $payload = $response.Content | ConvertFrom-Json -ErrorAction Stop
        } catch {
            $parseError = $_.Exception.Message
        }

        $hasToken = -not [string]::IsNullOrWhiteSpace([string]$payload.csrfToken)
        $hasHeader = -not [string]::IsNullOrWhiteSpace([string]$payload.headerName)
        $healthy = ($statusCode -eq 200) -and $hasToken -and $hasHeader
        $error = $null

        if (-not $healthy) {
            if ($parseError) {
                $error = "auth contract payload parse failed: $parseError"
            } elseif ($statusCode -ne 200) {
                $error = "unexpected auth contract status: $statusCode"
            } elseif (-not $hasToken -or -not $hasHeader) {
                $error = 'auth contract response is missing csrfToken or headerName'
            }
        }

        return [pscustomobject]@{
            Healthy = [bool]$healthy
            StatusCode = $statusCode
            Error = $error
            Url = $paths.AuthContractUrl
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return [pscustomobject]@{
            Healthy = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
            Url = $paths.AuthContractUrl
        }
    }
}

function Wait-AigsReady {
    param(
        [int]$Port = 18791,
        [int]$TimeoutSec = 20,
        [int]$PollMs = 500
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    $lastStatus = $null
    do {
        $lastStatus = Get-AigsServerStatus -Port $Port
        if ($lastStatus.Healthy) {
            return $lastStatus
        }
        Start-Sleep -Milliseconds $PollMs
    } while ((Get-Date) -lt $deadline)

    return $lastStatus
}

function New-AigsLaunchCommand {
    param(
        [int]$Port = 18791
    )

    $profile = $script:ProfilePath.Replace("'", "''")
    $repoRoot = $script:RepoRoot.Replace("'", "''")
    $serverEntry = $script:ServerEntry.Replace("'", "''")
    return ". '$profile'; Set-Location '$repoRoot'; `$env:PORT = '$Port'; node '$serverEntry'"
}

function Get-AigsServerStatus {
    param(
        [int]$Port = 18791
    )

    $paths = Ensure-AigsRuntimeDir -Port $Port
    $pidFromFile = Read-AigsPid -Port $Port
    $processFromFile = Get-AigsProcessById -ProcessId $pidFromFile

    if ($pidFromFile -and -not $processFromFile) {
        Remove-AigsPid -Port $Port
        $pidFromFile = $null
    }

    $listenerPid = Get-AigsListenerPid -Port $Port
    $listenerProcess = Get-AigsProcessById -ProcessId $listenerPid
    $managedPid = if ($listenerProcess) {
        [int]$listenerProcess.ProcessId
    } elseif ($processFromFile) {
        [int]$processFromFile.ProcessId
    } else {
        $null
    }

    if ($managedPid -and $pidFromFile -ne $managedPid) {
        Write-AigsPid -Port $Port -ProcessId $managedPid
    }

    $health = Invoke-AigsHealthCheck -Port $Port -TimeoutSec 5
    $authContract = Invoke-AigsAuthContractCheck -Port $Port -TimeoutSec 5
    $ready = [bool]($health.Healthy -and $authContract.Healthy)
    return [pscustomobject]@{
        Port = $Port
        Url = $paths.Url
        HealthUrl = $paths.HealthUrl
        AuthContractUrl = $paths.AuthContractUrl
        PidFile = $paths.PidFile
        StdoutLog = $paths.StdoutLog
        StderrLog = $paths.StderrLog
        ManagedPid = $managedPid
        ListenerPid = $listenerPid
        ProcessFound = [bool]$managedPid
        Healthy = $ready
        StatusCode = if ($ready) { 200 } else { $null }
        ApiHealthy = [bool]$health.Healthy
        ApiStatusCode = $health.StatusCode
        HealthError = $health.Error
        AuthContractHealthy = [bool]$authContract.Healthy
        AuthContractStatusCode = $authContract.StatusCode
        AuthContractError = $authContract.Error
    }
}

function Stop-AigsManagedProcess {
    param(
        [int]$Port = 18791,
        [switch]$Force
    )

    $status = Get-AigsServerStatus -Port $Port
    if (-not $status.ProcessFound) {
        Remove-AigsPid -Port $Port
        return $false
    }

    Stop-Process -Id $status.ManagedPid -Force:$Force.IsPresent -ErrorAction Stop
    Start-Sleep -Milliseconds 500
    Remove-AigsPid -Port $Port
    return $true
}
