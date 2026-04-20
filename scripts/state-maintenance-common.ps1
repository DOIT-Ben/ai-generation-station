$script:RepoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'local-server-common.ps1')

function Invoke-AigsStateMaintenanceJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $scriptPath = Join-Path $PSScriptRoot 'state-maintenance.js'
    Push-Location $script:RepoRoot
    try {
        $json = & node $scriptPath @Arguments '--json'
        if ($LASTEXITCODE -ne 0) {
            throw "state-maintenance command failed: $($Arguments -join ' ')"
        }
    } finally {
        Pop-Location
    }

    $rawOutput = if ($json -is [System.Array]) {
        ($json -join [Environment]::NewLine)
    } else {
        [string]$json
    }
    $lines = $rawOutput -split "(`r`n|`n|`r)"
    $jsonStartLine = -1
    for ($index = 0; $index -lt $lines.Length; $index += 1) {
        if ($lines[$index].TrimStart().StartsWith('{')) {
            $jsonStartLine = $index
            break
        }
    }

    if ($jsonStartLine -lt 0) {
        throw "state-maintenance command did not return JSON: $rawOutput"
    }

    $jsonPayload = ($lines[$jsonStartLine..($lines.Length - 1)] -join [Environment]::NewLine).Trim()
    return $jsonPayload | ConvertFrom-Json
}

function Get-AigsStateMaintenanceConfig {
    return Invoke-AigsStateMaintenanceJson -Arguments @('config')
}

function Get-AigsStateMaintenanceSummary {
    return Invoke-AigsStateMaintenanceJson -Arguments @('summary')
}

function Invoke-AigsAuditLogPrune {
    param(
        [Parameter(Mandatory = $true)]
        [int]$OlderThanDays
    )

    return Invoke-AigsStateMaintenanceJson -Arguments @('prune-audit-logs', '--older-than-days', $OlderThanDays)
}

function Resolve-AigsFullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (Test-Path -LiteralPath $Path) {
        return (Resolve-Path -LiteralPath $Path).Path
    }

    return [System.IO.Path]::GetFullPath($Path)
}

function Test-AigsPathWithinRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $resolvedRoot = Resolve-AigsFullPath -Path $Root
    $resolvedPath = Resolve-AigsFullPath -Path $Path
    $rootPrefix = if ($resolvedRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $resolvedRoot
    } else {
        $resolvedRoot + [System.IO.Path]::DirectorySeparatorChar
    }

    return $resolvedPath -eq $resolvedRoot -or $resolvedPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Assert-AigsPathWithinRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [string]$Label = 'Path'
    )

    if (-not (Test-AigsPathWithinRoot -Root $Root -Path $Path)) {
        throw "$Label '$Path' escapes allowed root '$Root'."
    }

    return (Resolve-AigsFullPath -Path $Path)
}

function Ensure-AigsDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Copy-AigsFileIfPresent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$DestinationDirectory
    )

    if (-not (Test-Path -LiteralPath $Source)) {
        return $false
    }

    Ensure-AigsDirectory -Path $DestinationDirectory
    Copy-Item -LiteralPath $Source -Destination (Join-Path $DestinationDirectory ([System.IO.Path]::GetFileName($Source))) -Force
    return $true
}

function Remove-AigsChildItems {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [string[]]$ExcludeNames = @()
    )

    if (-not (Test-Path -LiteralPath $Root)) {
        return
    }

    $resolvedRoot = Resolve-AigsFullPath -Path $Root
    Get-ChildItem -LiteralPath $resolvedRoot -Force | ForEach-Object {
        if ($ExcludeNames -contains $_.Name) {
            return
        }

        $targetPath = Assert-AigsPathWithinRoot -Root $resolvedRoot -Path $_.FullName -Label 'Removal target'
        Remove-Item -LiteralPath $targetPath -Recurse -Force
    }
}
