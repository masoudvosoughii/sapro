$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Removing previous build output..."
if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

Write-Host "Installing build dependencies..."
python -m pip install --upgrade pip
python -m pip install -e ".[dev,packaging]"

Write-Host "Running tests..."
python -m pytest -v --tb=short
python -m pytest -W error::RuntimeWarning --tb=short

Write-Host "Building SimplexSolver with PyInstaller..."
python -m PyInstaller --noconfirm "packaging/SimplexSolver.spec"

$ExePath = Join-Path $ProjectRoot "dist/SimplexSolver/SimplexSolver.exe"
if (-not (Test-Path $ExePath)) {
    throw "Expected executable was not created: $ExePath"
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
