param(
    [int]$AuditLogRetentionDays,
    [int]$BackupRetentionDays,
    [string]$BackupRoot
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

$effectiveAuditRetentionDays = if ($AuditLogRetentionDays -gt 0) { $AuditLogRetentionDays } else { [int]$config.auditLogRetentionDays }
$effectiveBackupRetentionDays = if ($BackupRetentionDays -gt 0) { $BackupRetentionDays } else { [int]$config.backupRetentionDays }

$auditPrune = Invoke-AigsAuditLogPrune -OlderThanDays $effectiveAuditRetentionDays

$removedBackups = @()
$cutoff = (Get-Date).AddDays(-$effectiveBackupRetentionDays)
if (Test-Path -LiteralPath $selectedBackupRoot) {
    Get-ChildItem -LiteralPath $selectedBackupRoot -Directory -Force | ForEach-Object {
        $backupDir = Assert-AigsPathWithinRoot -Root $selectedBackupRoot -Path $_.FullName -Label 'Backup prune target'
        $createdAt = $_.LastWriteTime
        $manifestPath = Join-Path $backupDir 'manifest.json'
        if (Test-Path -LiteralPath $manifestPath) {
            try {
                $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
                if ($manifest.createdAt) {
                    $createdAt = [datetime]$manifest.createdAt
                }
            } catch {
                $createdAt = $_.LastWriteTime
            }
        }

        if ($createdAt -lt $cutoff) {
            Remove-Item -LiteralPath $backupDir -Recurse -Force
            $removedBackups += $_.Name
        }
    }
}

$summaryAfter = Get-AigsStateMaintenanceSummary
Write-Output "Audit logs pruned: $($auditPrune.deletedCount)"
Write-Output "Audit retention days: $effectiveAuditRetentionDays"
Write-Output "Backup folders pruned: $($removedBackups.Count)"
Write-Output "Backup retention days: $effectiveBackupRetentionDays"
Write-Output "Remaining audit logs: $($summaryAfter.state.auditLogs.total)"
Write-Output "Remaining backup folders: $($summaryAfter.filesystem.backupEntryCount)"
