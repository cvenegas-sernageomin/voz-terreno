# Voz en terreno — notas para Claude

Dictado Whisper 100% offline en el navegador (Transformers.js + onnxruntime jsep). Repo `cvenegas-sernageomin/voz-terreno`:
rama `main` = fuente + scripts; rama `gh-pages` = lo publicado (runtime + modelo).
Ficha en memoria: `proyecto-voz-terreno` (y `reference-whisper-navegador-offline`).

## Comandos
`npm run preparar` (vendoriza + trae el modelo) · `npm run servir`.

## Reglas
- Integrado y en uso en la PWA **Geonotas Light** (`vendor/voz/`). Un cambio aquí debe copiarse allá y subir su versión.
- Sin COOP/COEP en Pages → `numThreads = 1`. Solo hace falta la variante **jsep** de onnxruntime.
- El modelo vive en un solo lugar por la Cache API (alcance de origen).
- Worker desde Blob: resolver URLs relativas a absolutas antes del `postMessage`.
