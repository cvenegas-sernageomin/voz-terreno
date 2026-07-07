# build.ps1 - Voz Terreno module builder
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Descargar Transformers.js si no existe
if (-not (Test-Path "vendor\transformers.min.js")) {
    Write-Host "Descargando Transformers.js..."
    New-Item -ItemType Directory -Force vendor | Out-Null
    Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js" `
        -OutFile "vendor\transformers.min.js" -TimeoutSec 120
    Write-Host "OK"
}

# 2. Copiar archivos a dist/
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item "vendor\transformers.min.js" "dist\transformers.min.js" -Force
Copy-Item "src\whisper-worker.js"      "dist\whisper-worker.js"    -Force

# 3. Concatenar voz-module.js
$parts = @(
    (Get-Content "src\vocabulario.js"  -Raw -Encoding UTF8),
    (Get-Content "src\extractor.js"    -Raw -Encoding UTF8),
    (Get-Content "src\ui.js"           -Raw -Encoding UTF8),
    (Get-Content "src\coordinator.js"  -Raw -Encoding UTF8)
)
$bundle = $parts -join "`n`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText(
    (Join-Path $PSScriptRoot "dist\voz-module.js"),
    $bundle,
    $utf8NoBom
)

$kb = [math]::Round((Get-Item "dist\voz-module.js").Length / 1KB)
Write-Host "dist\voz-module.js: $kb KB"
Write-Host "Build OK"
