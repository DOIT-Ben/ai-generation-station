param(
    [string]$BackupId,
    [string]$BackupPath,
    [int]$Port = 18791,
    [switch]$StartAfterRestore
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'state-maintenance-common.ps1')

if (-not $BackupId -and -not $BackupPath) {
    throw 'Either -BackupId or -BackupPath is required.'
}

$config = Get-AigsStateMaintenanceConfig
$repoRoot = Assert-AigsPathWithinRoot -Root $script:RepoRoot -Path $config.repoRoot -Label 'Repo root'
$backupRoot = Assert-AigsPathWithinRoot -Root $repoRoot -Path $config.backupDir -Label 'Backup root'
$selectedBackupPath = if ($BackupPath) {
    Assert-AigsPathWithinRoot -Root $backupRoot -Path $BackupPath -Label 'Backup path'
} else {
    Assert-AigsPathWithinRoot -Root $backupRoot -Path (Join-Path $backupRoot $BackupId) -Label 'Backup path'
}

$manifestPath = Join-Path $selectedBackupPath 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Backup manifest not found: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ([int]$manifest.schemaVersion -ne 1) {
    throw "Unsupported backup manifest schema version: $($manifest.schemaVersion)"
}

$stateSourceDir = Join-Path $selectedBackupPath 'state'
if (-not (Test-Path -LiteralPath $stateSourceDir)) {
    throw "Backup state directory not found: $stateSourceDir"
}

$status = Get-AigsServerStatus -Port $Port
if ($status.ListenerPid -and -not $status.ProcessFound) {
    throw "Port $Port is in use by PID $($status.ListenerPid), but it is not recognized as the managed repo server. Refusing to continue restore."
}

$restartManagedService = [bool]$status.ProcessFound -or [bool]$StartAfterRestore
if ($status.ProcessFound) {
    Stop-AigsManagedProcess -Port $Port -Force | Out-Null
}

$appStateDb = Assert-AigsPathWithinRoot -Root $repoRoot -Path $config.appStateDb -Label 'State DB'
$dbDirectory = Split-Path -Parent $appStateDb
Ensure-AigsDirectory -Path $dbDirectory

$restoreStateFiles = @(
    $appStateDb,
    "$appStateDb-wal",
    "$appStateDb-shm"
)

foreach ($target in $restoreStateFiles) {
    $resolvedTarget = Assert-AigsPathWithinRoot -Root $repoRoot -Path $target -Label 'State restore target'
    if (Test-Path -LiteralPath $resolvedTarget) {
        Remove-Item -LiteralPath $resolvedTarget -Force
    }
}

Get-ChildItem -LiteralPath $stateSourceDir -Force | ForEach-Object {
    $sourcePath = Assert-AigsPathWithinRoot -Root $selectedBackupPath -Path $_.FullName -Label 'Backup state source'
    Copy-Item -LiteralPath $sourcePath -Destination $dbDirectory -Force
}

$restoredOutputEntries = 0
if ($manifest.output.included) {
    $outputSourceDir = Join-Path $selectedBackupPath 'output'
    if (Test-Path -LiteralPath $outputSourceDir) {
        $resolvedOutputDir = Assert-AigsPathWithinRoot -Root $repoRoot -Path $config.outputDir -Label 'Output directory'
        Ensure-AigsDirectory -Path $resolvedOutputDir
        Remove-AigsChildItems -Root $resolvedOutputDir -ExcludeNames @($config.excludedOutputEntries)
        Get-ChildItem -LiteralPath $outputSourceDir -Force | ForEach-Object {
            $sourcePath = Assert-AigsPathWithinRoot -Root $selectedBackupPath -Path $_.FullName -Label 'Backup output source'
            Copy-Item -LiteralPath $sourcePath -Destination $resolvedOutputDir -Recurse -Force
            $restoredOutputEntries += 1
        }
    }
}

if ($restartManagedService) {
    & (Join-Path $PSScriptRoot 'start-local-service.ps1') -Port $Port | Out-Null
}

$summaryAfter = Get-AigsStateMaintenanceSummary
Write-Output "Restore completed from: $selectedBackupPath"
Write-Output "Output entries restored: $restoredOutputEntries"
Write-Output "Current users: $($summaryAfter.state.users)"
Write-Output "Current audit logs: $($summaryAfter.state.auditLogs.total)"
if ($restartManagedService) {
    Write-Output "Managed local service is running on port $Port."
}
