// Baja el modelo Whisper desde HuggingFace al repo, para autohospedarlo.
//
// Autohospedamos a proposito: el modulo tiene que funcionar en terreno sin señal, y depender del
// CDN de HuggingFace en el momento de la descarga es una dependencia que no controlamos. Ademas,
// servirlo desde nuestro propio origen hace que la Cache API lo comparta entre TODAS las PWAs
// (todas viven en cvenegas-sernageomin.github.io), asi que se baja una sola vez para todas.
//
// Se eligen los pesos CUANTIZADOS (int8): 22 MB de encoder + 51 MB de decoder. Los no cuantizados
// (79 y 199 MB) pasarian el limite duro de 100 MB por archivo de GitHub y obligarian a Git LFS.
//
// Uso:  node scripts/traer-modelo.mjs [--modelo onnx-community/whisper-base]

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

const arg = (n, def) => {
  const i = process.argv.indexOf(n);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const MODELO = arg('--modelo', 'Xenova/whisper-base');
const DESTINO = join(RAIZ, 'modelo', ...MODELO.split('/'));

// Los .json/.txt de la raiz son la config y el tokenizador; pesan poco (~4 MB) y transformers.js
// pide varios de ellos segun el caso, asi que se bajan todos en vez de adivinar cuales.
const ARCHIVOS_RAIZ = [
  'config.json', 'generation_config.json', 'preprocessor_config.json',
  'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json',
  'added_tokens.json', 'vocab.json', 'merges.txt', 'normalizer.json',
];
const ARCHIVOS_ONNX = [
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

const mb = b => (b / 1048576).toFixed(1) + ' MB';

async function bajar(rutaRelativa) {
  const destino = join(DESTINO, ...rutaRelativa.split('/'));
  try {
    const s = await stat(destino);
    if (s.size > 0) { console.log(`  ya estaba  ${rutaRelativa} (${mb(s.size)})`); return s.size; }
  } catch { /* no existe: se baja */ }

  const url = `https://huggingface.co/${MODELO}/resolve/main/${rutaRelativa}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} al bajar ${rutaRelativa}`);
  const buf = Buffer.from(await r.arrayBuffer());

  // Un repo mal escrito o un archivo movido devuelve 200 con una pagina HTML de error; guardarla
  // como si fuera el modelo produce un fallo incomprensible recien al cargar el pipeline.
  if (buf.length === 0) throw new Error(`${rutaRelativa} vino vacio`);
  if (rutaRelativa.endsWith('.onnx') && buf.length < 1024 * 1024)
    throw new Error(`${rutaRelativa} pesa solo ${mb(buf.length)} — no parece un modelo`);

  // El limite de GitHub es duro: sobre 100 MB rechaza el push y quedariamos con el repo a medias.
  if (buf.length > 100 * 1048576)
    throw new Error(`${rutaRelativa} pesa ${mb(buf.length)} y no entra en GitHub sin Git LFS`);

  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, buf);
  console.log(`  bajado     ${rutaRelativa} (${mb(buf.length)})`);
  return buf.length;
}

console.log(`Modelo: ${MODELO}`);
console.log(`Destino: ${DESTINO}\n`);

let total = 0;
for (const f of [...ARCHIVOS_RAIZ, ...ARCHIVOS_ONNX]) {
  total += await bajar(f);
}
console.log(`\nTotal: ${mb(total)}`);
