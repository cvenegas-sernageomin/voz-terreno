# build.ps1 - Voz Terreno module builder
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Descargar Transformers.js si no existe
if (-not (Test-Path "vendor\transformers.min.js")) {
    Write-Host "Descargando Transformers.js..."
    Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js" `
        -OutFile "vendor\transformers.min.js"
    Write-Host "OK"
}

# 2. Copiar archivos a dist/
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
Set-Content "dist\voz-module.js" $bundle -Encoding UTF8

$kb = [math]::Round((Get-Item "dist\voz-module.js").Length / 1KB)
Write-Host "dist\voz-module.js: $kb KB"
Write-Host "Build OK"
