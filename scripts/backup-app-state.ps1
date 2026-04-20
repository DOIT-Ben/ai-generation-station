param(
    [int]$Port = 18791,
    [string]$BackupRoot,
    [switch]$SkipOutput,
    [switch]$NoServiceStop,
    [switch]$KeepStopped
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'state-maintenance-common.ps1')

$config = Get-AigsStateMaintenanceConfig
$repoRoot = Assert-AigsPathWithinRoot -Root $script:RepoRoot -Path $config.repoRoot -Label 'Repo root'
$selectedBackupRoot = if ($BackupRoot) {
    Assert-AigsPathWithinRoot -Root $repoRoot -Path $BackupRoot -Label 'Backup root'
} else {
    Assert-AigsPathWithinRoot -Root $repoRoot -Path $config.backupDir -Label 'Backup root'
}

Ensure-AigsDirectory -Path $selectedBackupRoot

$backupId = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Assert-AigsPathWithinRoot -Root $selectedBackupRoot -Path (Join-Path $selectedBackupRoot $backupId) -Label 'Backup directory'
if (Test-Path -LiteralPath $backupDir) {
    throw "Backup directory already exists: $backupDir"
}

$stateDir = Join-Path $backupDir 'state'
$outputDir = Join-Path $backupDir 'output'
Ensure-AigsDirectory -Path $stateDir
if (-not $SkipOutput) {
    Ensure-AigsDirectory -Path $outputDir
}

$status = Get-AigsServerStatus -Port $Port
if ($status.ListenerPid -and -not $status.ProcessFound) {
    throw "Port $Port is in use by PID $($status.ListenerPid), but it is not recognized as the managed repo server. Refusing to assume backup safety."
}

$restartManagedService = $false
if (-not $NoServiceStop -and $status.ProcessFound) {
    Stop-AigsManagedProcess -Port $Port -Force | Out-Null
    $restartManagedService = -not $KeepStopped
}

$summaryBefore = Get-AigsStateMaintenanceSummary

try {
    $stateFiles = @(
        $config.appStateDb,
        "$($config.appStateDb)-wal",
        "$($config.appStateDb)-shm"
    )
    $copiedStateFiles = @()
    foreach ($source in $stateFiles) {
        if (Copy-AigsFileIfPresent -Source $source -DestinationDirectory $stateDir) {
            $copiedStateFiles += [System.IO.Path]::GetFileName($source)
        }
    }

    $copiedOutputEntries = @()
    if (-not $SkipOutput -and (Test-Path -LiteralPath $config.outputDir)) {
        Get-ChildItem -LiteralPath $config.outputDir -Force | ForEach-Object {
            if ($config.excludedOutputEntries -contains $_.Name) {
                return
            }

            $sourcePath = Assert-AigsPathWithinRoot -Root $config.outputDir -Path $_.FullName -Label 'Output source'
            Copy-Item -LiteralPath $sourcePath -Destination $outputDir -Recurse -Force
            $copiedOutputEntries += $_.Name
        }
    }

    $gitCommit = $null
    try {
        Push-Location $repoRoot
        $gitCommit = (& git -C $repoRoot rev-parse HEAD 2>$null)
    } finally {
        Pop-Location
    }

    $manifest = [pscustomobject]@{
        schemaVersion = 1
        backupId = $backupId
        createdAt = (Get-Date).ToString('o')
        repoRoot = $repoRoot
        gitCommit = if ($gitCommit) { [string]$gitCommit } else { $null }
        state = [pscustomobject]@{
            appStateDb = $config.appStateDb
            copiedFiles = $copiedStateFiles
        }
        output = [pscustomobject]@{
            included = (-not $SkipOutput)
            sourceDir = $config.outputDir
            excludedEntries = @($config.excludedOutputEntries)
            copiedEntries = $copiedOutputEntries
        }
        retentionDefaults = [pscustomobject]@{
            auditLogRetentionDays = $config.auditLogRetentionDays
            backupRetentionDays = $config.backupRetentionDays
        }
        service = [pscustomobject]@{
            port = $Port
            wasManagedProcessRunning = [bool]$status.ProcessFound
            managedPidBeforeStop = $status.ManagedPid
            restartRequested = [bool]$restartManagedService
        }
        summaryBefore = $summaryBefore
    }

    $manifestPath = Join-Path $backupDir 'manifest.json'
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
} finally {
    if ($restartManagedService) {
        & (Join-Path $PSScriptRoot 'start-local-service.ps1') -Port $Port | Out-Null
    }
}

Write-Output "Backup created: $backupDir"
Write-Output "Manifest: $manifestPath"
Write-Output "State files copied: $($copiedStateFiles.Count)"
Write-Output "Output entries copied: $($copiedOutputEntries.Count)"
if ($restartManagedService) {
    Write-Output "Managed local service restarted on port $Port."
}
