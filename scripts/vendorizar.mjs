// Copia el runtime desde node_modules a vendor/voz/ (lo que se publica y lo que cada PWA copia).
//
// Se vendoriza desde node_modules a proposito, en vez de bajar un bundle de un CDN: asi el bundle
// de Transformers y los binarios de onnxruntime salen SIEMPRE de la misma instalacion y no pueden
// quedar desparejados. Emparejarlos mal es exactamente la clase de bug que ya costo una
// integracion completa (ver README).

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'vendor', 'voz');

// transformers.min.js y NO transformers.web.min.js: el "web" trae imports pelados
// ("onnxruntime-common", "onnxruntime-web/webgpu") que el navegador no sabe resolver sin un
// import map, y en un Worker no hay forma de darle uno. El .min.js trae onnxruntime adentro.
//
// De onnxruntime solo la variante JSEP: es la unica que transformers 3.x pide (verificado
// quitando la otra y comprobando que igual carga). La no-jsep sobra.
const ARCHIVOS = [
  ['@huggingface/transformers/dist/transformers.min.js', 'transformers.min.js'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.wasm'],
  ['onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.mjs'],
];

const mb = b => (b / 1048576).toFixed(1) + ' MB';

await mkdir(DESTINO, { recursive: true });

// La v4 de Transformers.js NO sirve: su onnxruntime (1.26-dev) no puede abrir los pesos Whisper
// cuantizados y muere con "TransposeDQWeightsForMatMulNBits Missing required scale". Si alguien
// sube la version sin querer, que se entere aca y no en terreno.
const ver = JSON.parse(await readFile(join(RAIZ, 'node_modules/@huggingface/transformers/package.json'), 'utf8')).version;
if (!/^3\./.test(ver)) {
  console.error(`\n  ✗ @huggingface/transformers ${ver}: se espera una 3.x.`);
  console.error('    La 4.x no abre los modelos Whisper cuantizados (MatMulNBits).\n');
  process.exit(1);
}

console.log(`transformers ${ver} → vendor/voz/\n`);
let total = 0;
for (const [desde, hacia] of ARCHIVOS) {
  const o = join(RAIZ, 'node_modules', desde);
  await copyFile(o, join(DESTINO, hacia));
  const s = await stat(join(DESTINO, hacia));
  total += s.size;
  console.log(`  ${hacia}  (${mb(s.size)})`);
}
console.log(`\nRuntime: ${mb(total)} (+ voz.js y whisper-worker.js, que son fuente de este repo)`);
