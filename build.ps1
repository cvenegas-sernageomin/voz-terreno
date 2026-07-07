$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Descargar Transformers.js
if (-not (Test-Path "vendor\transformers.min.js")) {
    Write-Host "Descargando Transformers.js (~3 MB)..."
    Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js" `
        -OutFile "vendor\transformers.min.js"
}

# 2. Copiar a dist/
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item "vendor\transformers.min.js" "dist\transformers.min.js" -Force
Copy-Item "src\whisper-worker.js"      "dist\whisper-worker.js"    -Force

# 3. Construir voz-module.js (concatenacion de fuentes)
$parts = @(
    "/* voz-module.js - VozTerreno $(Get-Date -Format 'yyyy-MM-dd') */",
    (Get-Content "src\vocabulario.js"  -Raw -Encoding UTF8),
    (Get-Content "src\extractor.js"    -Raw -Encoding UTF8),
    (Get-Content "src\ui.js"           -Raw -Encoding UTF8),
    (Get-Content "src\coordinator.js"  -Raw -Encoding UTF8)
)
$bundle = $parts -join "`n`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "dist\voz-module.js"), $bundle, $utf8NoBom)

# 4. SW del modulo
$swContent = @"
const CACHE = 'voz-v1';
const ASSETS = ['./voz-module.js','./whisper-worker.js','./transformers.min.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "dist\sw.js"), $swContent, $utf8NoBom)

# 5. .nojekyll
New-Item -Force "dist\.nojekyll" -ItemType File | Out-Null

$kbMod = [math]::Round((Get-Item "dist\voz-module.js").Length / 1KB)
$kbTf  = [math]::Round((Get-Item "dist\transformers.min.js").Length / 1KB)
Write-Host "dist\voz-module.js:       $kbMod KB"
Write-Host "dist\transformers.min.js: $kbTf KB"
Write-Host "Build OK"
