// whisper-worker.js
// Transformers.js is prepended by the coordinator before creating this Worker as a blob
// The global created by the Transformers.js IIFE is accessed as self.Transformers

let _pipe = null;

async function cargarModelo(onProgreso) {
  const { pipeline, env } = self.Transformers;
  env.allowLocalModels = false;
  env.useBrowserCache   = true;

  _pipe = await pipeline(
    "automatic-speech-recognition",
    "openai/whisper-small",
    {
      quantized: true,
      progress_callback: info => {
        self.postMessage({ tipo: "progreso", status: info.status, progress: info.progress });
      }
    }
  );
  self.postMessage({ tipo: "modelo-listo" });
}

async function transcribir(float32) {
  if (!_pipe) {
    self.postMessage({ tipo: "error", msg: "Modelo no cargado" });
    return;
  }
  try {
    const resultado = await _pipe(float32, { language: "spanish", task: "transcribe" });
    self.postMessage({ tipo: "transcripcion", texto: resultado.text.trim() });
  } catch (err) {
    self.postMessage({ tipo: "error", msg: err.message });
  }
}

self.onmessage = async e => {
  const { tipo, datos } = e.data;
  if (tipo === "cargar")      await cargarModelo();
  if (tipo === "transcribir") await transcribir(datos);
};
