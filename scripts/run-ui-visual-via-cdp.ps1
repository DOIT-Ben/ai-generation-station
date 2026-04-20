param(
    [ValidateSet('auto', 'chrome', 'edge')]
    [string]$Browser = 'auto',
    [int]$CdpPort = 9223,
    [int]$AppPort = 18791,
    [switch]$NoLaunchServer,
    [switch]$ShowBrowser,
    [switch]$UpdateBaseline
)

$ErrorActionPreference = 'Stop'

function Resolve-BrowserExecutable {
    param(
        [string]$RequestedBrowser
    )

    $candidates = @()
    if ($RequestedBrowser -in @('auto', 'edge')) {
        $candidates += @(
            @{
                Name = 'edge'
                Path = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
            },
            @{
                Name = 'edge'
                Path = 'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
            }
        )
    }
    if ($RequestedBrowser -in @('auto', 'chrome')) {
        $candidates += @(
            @{
                Name = 'chrome'
                Path = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
            },
            @{
                Name = 'chrome'
                Path = 'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
            }
        )
    }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate.Path) {
            return $candidate
        }
    }

    throw "No supported browser executable found for '$RequestedBrowser'."
}

function Wait-ForCdp {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 20
    )

    $url = "http://127.0.0.1:$Port/json/version"
    $startedAt = Get-Date
    while (((Get-Date) - $startedAt).TotalSeconds -lt $TimeoutSeconds) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                return $url
            }
        } catch {
            Start-Sleep -Milliseconds 250
        }
    }

    throw "CDP endpoint did not become ready: $url"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$browserInfo = Resolve-BrowserExecutable -RequestedBrowser $Browser
$profileRoot = Join-Path $env:TEMP ("aigs-ui-visual-cdp-" + $browserInfo.Name + "-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $profileRoot | Out-Null

$browserArgs = @(
    "--remote-debugging-port=$CdpPort",
    '--remote-debugging-address=127.0.0.1',
    "--user-data-dir=$profileRoot",
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu'
)

if (-not $ShowBrowser) {
    $browserArgs += '--headless=new'
}

$browserArgs += 'about:blank'

Write-Host "Starting $($browserInfo.Name) with CDP on port $CdpPort..."
$browserProcess = Start-Process -FilePath $browserInfo.Path -ArgumentList $browserArgs -PassThru

try {
    $cdpUrl = Wait-ForCdp -Port $CdpPort
    Write-Host "CDP ready: $cdpUrl"

    $nodeArgs = @(
        'test-ui-visual.js',
        '--port', $AppPort,
        '--cdp-url', "http://127.0.0.1:$CdpPort"
    )

    if (-not $NoLaunchServer) {
        $nodeArgs += '--launch-server'
    }
    if ($UpdateBaseline) {
        $nodeArgs += '--update-baseline'
    }

    Write-Host "Running UI visual regression from $projectRoot..."
    & node $nodeArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    if ($browserProcess -and -not $browserProcess.HasExited) {
        Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $profileRoot -Recurse -Force -ErrorAction SilentlyContinue
}
