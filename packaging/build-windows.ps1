$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Command"
    }
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $ProjectRoot
try {
    Write-Host "Removing previous build output..."
    if (Test-Path "build") {
        Remove-Item -Recurse -Force "build"
    }
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist"
    }

    Write-Host "Installing build dependencies..."
    Invoke-CheckedCommand { python -m pip install --upgrade pip }
    Invoke-CheckedCommand { python -m pip install -e ".[dev,packaging]" }

    Write-Host "Running tests..."
    Invoke-CheckedCommand { python -m pytest -v --tb=short }
    Invoke-CheckedCommand { python -m pytest -W error::RuntimeWarning --tb=short }

    Write-Host "Building SimplexSolver with PyInstaller..."
    Invoke-CheckedCommand { python -m PyInstaller --noconfirm "packaging/SimplexSolver.spec" }

    $ExePath = Join-Path $ProjectRoot "dist/SimplexSolver/SimplexSolver.exe"
    if (-not (Test-Path $ExePath)) {
        throw "Expected executable was not created: $ExePath"
    }
    Write-Host "Smoke-testing packaged executable..."

$AppProcess = Start-Process -FilePath $ExePath -PassThru

try {
    $Deadline = (Get-Date).AddSeconds(20)
    $Ready = $false
    $WorkingUrl = $null

    while ((Get-Date) -lt $Deadline) {
        if ($AppProcess.HasExited) {
            throw "Packaged executable exited immediately with code $($AppProcess.ExitCode)"
        }

        foreach ($Port in 5678..5687) {
            try {
                $Url = "http://127.0.0.1:$Port"
                $Response = Invoke-WebRequest `
                    -Uri $Url `
                    -UseBasicParsing `
                    -TimeoutSec 2

                if ($Response.StatusCode -eq 200) {
                    $Ready = $true
                    $WorkingUrl = $Url
                    break
                }
            }
            catch {
                # Application may still be starting.
            }
        }

        if ($Ready) {
            break
        }

        Start-Sleep -Milliseconds 500
    }

    if (-not $Ready) {
        throw "Packaged executable did not expose a working local server within 20 seconds."
    }

    Write-Host "Packaged executable smoke test passed at $WorkingUrl"
}
finally {
    if (-not $AppProcess.HasExited) {
        Stop-Process -Id $AppProcess.Id -Force
        $AppProcess.WaitForExit()
    }
}
    Write-Host "Copying user-facing files..."
    Copy-Item -Force (Join-Path $ProjectRoot "START_HERE.txt") (Join-Path $ProjectRoot "dist/SimplexSolver/START_HERE.txt")
    Copy-Item -Force (Join-Path $ProjectRoot "LICENSE") (Join-Path $ProjectRoot "dist/SimplexSolver/LICENSE")

    $ZipPath = Join-Path $ProjectRoot "Simplex-Solver-Windows.zip"
    if (Test-Path $ZipPath) {
        Remove-Item -Force $ZipPath
    }

    Write-Host "Creating $ZipPath ..."
    Compress-Archive -Path (Join-Path $ProjectRoot "dist/SimplexSolver/*") -DestinationPath $ZipPath

    Write-Host "Windows build complete."
    Write-Host "Executable: $ExePath"
    Write-Host "Archive: $ZipPath"
}
finally {
    Pop-Location
}
