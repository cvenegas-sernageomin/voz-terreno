// Worker de transcripcion Whisper. Corre en un hilo aparte para no congelar la interfaz
// mientras transcribe (en un telefono eso son varios segundos).
//
// ---------------------------------------------------------------------------------------------
// ESTE ARCHIVO SE CARGA COMO **MODULE WORKER DESDE SU URL REAL**, nunca desde un blob:
//     new Worker(<url de este archivo>, { type: 'module' })
//
// El intento anterior (voz-module.js:692 del modulo viejo) concatenaba el bundle ESM de
// Transformers con el codigo del worker y lo lanzaba como Worker CLASICO desde un Blob. Eso
// fallaba siempre con "Unexpected token 'export'" -- el bundle es ESM y un worker clasico no
// entiende `export` -- y ademas leia un global `self.Transformers` que el build ESM nunca crea.
// Ese error cronico fue el que hizo retirar el dictado de catastro-remociones en su v22.
//
// Cargarlo desde su URL real ademas arregla un segundo problema conocido: un worker nacido de un
// blob resuelve las rutas relativas contra la URL del blob, asi que el `import` de abajo no
// encontraria nada. Desde la URL real, './transformers.min.js' resuelve al lado de este
// archivo, que es donde esta.
// ---------------------------------------------------------------------------------------------

import { pipeline, env } from './transformers.min.js';

// Los binarios de onnxruntime van junto a este archivo. Sin esto, Transformers.js los baja de
// cdn.jsdelivr.net en tiempo de ejecucion: la app pareceria andar en la oficina y fallaria en
// terreno. Es el segundo bug de fondo del modulo viejo, que nunca se llego a ver porque el
// primero abortaba antes.
env.backends.onnx.wasm.wasmPaths = new URL('./', import.meta.url).href;

// GitHub Pages no manda las cabeceras COOP/COEP, asi que no hay SharedArrayBuffer y los hilos de
// WASM no estan disponibles. La app ya se topo con esto en GDAL (lo resolvio con useWorker:false).
env.backends.onnx.wasm.numThreads = 1;

let _pipe = null;

async function cargar({ modeloBase, modeloId }) {
  // allowRemoteModels:false es deliberado. Si una ruta queda mal, queremos un fallo RUIDOSO aqui
  // y no que se baje el modelo de HuggingFace por atras y todo "funcione" hasta que el geologo
  // se quede sin señal. Es exactamente el modo de falla que dejo el modulo viejo roto sin que
  // nadie lo notara.
  env.allowLocalModels  = true;
  env.allowRemoteModels = false;
  env.localModelPath    = modeloBase;
  env.useBrowserCache   = true;   // Cache API, con alcance de ORIGEN: el modelo se baja una vez
                                  // y lo comparten todas las PWAs del mismo dominio.

  _pipe = await pipeline('automatic-speech-recognition', modeloId, {
    dtype: 'q8',                  // -> *_quantized.onnx (22 MB encoder + 51 MB decoder)
    device: 'wasm',
    progress_callback: info => self.postMessage({ tipo: 'progreso', info }),
  });
  self.postMessage({ tipo: 'listo' });
}

async function transcribir(datos) {
  if (!_pipe) throw new Error('El modelo todavia no esta cargado');
  const audio = datos.audio || datos;          // compatible con el formato viejo (solo el Float32)
  const opciones = {
    language: 'spanish',
    task: 'transcribe',
    // Whisper solo "ve" 30 s por vez: sin trocear, un dictado largo se corta en seco. El solape
    // evita perder la palabra justo en el corte.
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  // Opciones extra de generacion. MEDIDO en transformers.js 3.8.1 (2026-08-30):
  //   - Las opciones SI llegan al modelo: max_new_tokens:8 trunca la salida como corresponde.
  //   - Pero `prompt` (sesgar el decodificador con vocabulario) y `num_beams` (busqueda por
  //     haces) estan IGNORADOS en silencio para Whisper: misma transcripcion palabra por palabra
  //     y sin costo de tiempo (beams=5 deberia tardar el triple). O sea que NO se puede mejorar
  //     el vocabulario tecnico sesgando el reconocimiento; hay que corregir despues.
  // Se deja el paso de opciones abierto igual, para poder medir de nuevo cuando cambie la version.
  if (datos.opts) Object.assign(opciones, datos.opts);

  const r = await _pipe(audio, opciones);
  self.postMessage({ tipo: 'texto', texto: (r.text || '').trim() });
}

self.onmessage = async e => {
  const { tipo, datos } = e.data || {};
  try {
    if (tipo === 'cargar')      await cargar(datos);
    if (tipo === 'transcribir') await transcribir(datos);
  } catch (err) {
    // El worker no puede dejar a la interfaz esperando para siempre: todo error viaja de vuelta.
    self.postMessage({ tipo: 'error', msg: String((err && err.message) || err), fase: tipo });
  }
};
