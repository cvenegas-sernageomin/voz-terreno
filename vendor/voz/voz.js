/* VozTerreno — dictado por voz 100% offline para las PWAs de terreno.
 *
 * Se carga como script clasico y expone window.VozTerreno:
 *     <script src="vendor/voz/voz.js"></script>
 *     VozTerreno.montarBoton(miTextarea);
 *
 * COMO SE REPARTEN LOS ARCHIVOS (y por que)
 *   - El RUNTIME (este archivo, whisper-worker.js, transformers.min.js y el .wasm) se copia
 *     dentro de cada PWA, en vendor/voz/. Tiene que quedar bajo el scope del Service Worker de
 *     la app para que su cache-first lo capture; servido desde otro path, dependeria de la cache
 *     HTTP (que en GitHub Pages es corta) y podria faltar justo en terreno.
 *   - El MODELO (~78 MB) vive en UN solo lugar publicado. Transformers.js lo guarda en la Cache
 *     API, que tiene alcance de ORIGEN: como todas las PWAs viven en el mismo dominio, se baja
 *     una sola vez y las demas ya lo encuentran descargado.
 */
(function () {
  'use strict';

  // Ruta del runtime: al lado de este archivo. Se resuelve al cargar el script, no despues,
  // porque document.currentScript vale null dentro de los callbacks.
  const RUNTIME = (function () {
    const s = document.currentScript;
    return s ? new URL('./', s.src).href : new URL('vendor/voz/', location.href).href;
  })();

  const cfg = {
    runtime: RUNTIME,
    modelo:  'https://cvenegas-sernageomin.github.io/voz-terreno/modelo/',
    modeloId: 'Xenova/whisper-base',
  };

  let _worker = null, _estado = 'sin-descargar', _cargando = null;
  const CACHE_TF = 'transformers-cache';   // el nombre que usa Transformers.js internamente

  const urlModelo = f => cfg.modelo + cfg.modeloId + '/' + f;
  // Los dos pesos son el grueso de la descarga: si estan, el modelo esta.
  const CLAVES = ['onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];

  function configurar(o) { Object.assign(cfg, o || {}); }
  function estado() { return _estado; }

  // ---- Estado en disco --------------------------------------------------------------------
  async function estaDescargado() {
    if (!self.caches) return false;
    try {
      const c = await caches.open(CACHE_TF);
      for (const f of CLAVES) if (!(await c.match(urlModelo(f)))) return false;
      return true;
    } catch { return false; }
  }

  async function tamanoEnDisco() {
    if (!self.caches) return 0;
    try {
      const c = await caches.open(CACHE_TF);
      let total = 0;
      for (const k of await c.keys()) {
        if (!k.url.startsWith(cfg.modelo)) continue;
        const r = await c.match(k);
        if (r) total += (await r.blob()).size;
      }
      return total;
    } catch { return 0; }
  }

  async function borrar() {
    if (!self.caches) return;
    const c = await caches.open(CACHE_TF);
    // Se borran SOLO las entradas de nuestro modelo: la misma cache puede tener otros modelos
    // de otras apps del mismo origen, y llevarselos por delante seria un efecto colateral feo.
    for (const k of await c.keys()) if (k.url.startsWith(cfg.modelo)) await c.delete(k);
    if (_worker) { _worker.terminate(); _worker = null; }
    _estado = 'sin-descargar';
  }

  // ---- Worker -----------------------------------------------------------------------------
  function nacerWorker() {
    if (_worker) return _worker;
    // Desde su URL REAL y como modulo. Nunca desde un Blob: el modulo anterior concatenaba el
    // bundle ESM en un worker clasico y moria con "Unexpected token 'export'" (fue lo que hizo
    // retirar el dictado de catastro-remociones). Ademas, un worker nacido de un blob no resuelve
    // las rutas relativas del import.
    _worker = new Worker(cfg.runtime + 'whisper-worker.js', { type: 'module' });
    return _worker;
  }

  // Carga el modelo en el worker. La primera vez baja ~78 MB; despues sale de la Cache API en
  // segundos. Es la MISMA operacion en ambos casos, por eso hay una sola funcion.
  function cargar(onProgreso) {
    if (_estado === 'listo') return Promise.resolve();
    if (_cargando) return _cargando;                  // llamadas simultaneas comparten la promesa

    _estado = 'descargando';
    _cargando = new Promise((res, rej) => {
      const w = nacerWorker();
      const porArchivo = {};
      const alMensaje = e => {
        const m = e.data;
        if (m.tipo === 'progreso' && onProgreso) {
          const i = m.info;
          if (i.file && i.status === 'progress') porArchivo[i.file] = i.progress || 0;
          else if (i.file && i.status === 'done') porArchivo[i.file] = 100;
          const vals = Object.values(porArchivo);
          onProgreso({
            archivo: i.file || '',
            pct: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
          });
        }
        if (m.tipo === 'listo') { limpiar(); _estado = 'listo'; res(); }
        if (m.tipo === 'error' && m.fase === 'cargar') { limpiar(); _estado = 'sin-descargar'; rej(new Error(m.msg)); }
      };
      const alError = () => { limpiar(); _estado = 'sin-descargar'; rej(new Error('El worker de voz no pudo arrancar')); };
      function limpiar() { w.removeEventListener('message', alMensaje); w.removeEventListener('error', alError); _cargando = null; }
      w.addEventListener('message', alMensaje);
      w.addEventListener('error', alError);
      w.postMessage({ tipo: 'cargar', datos: { modeloBase: cfg.modelo, modeloId: cfg.modeloId } });
    });
    return _cargando;
  }

  async function descargar(onProgreso) {
    // Sin esto el navegador puede desalojar 78 MB de cache cuando le apriete el espacio, y el
    // geologo se entera en terreno, sin señal para recuperarlos.
    if (navigator.storage && navigator.storage.persist) {
      try { await navigator.storage.persist(); } catch { /* no es fatal */ }
    }
    return cargar(onProgreso);
  }

  // ---- Audio ------------------------------------------------------------------------------
  // Whisper espera Float32 mono a 16 kHz. MediaRecorder entrega webm/opus en Chrome y mp4/aac en
  // Safari, asi que se decodifica con AudioContext (acepta ambos) en vez de asumir un formato.
  async function aFloat32(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * 16000)), 16000);
    const src = off.createBufferSource();
    src.buffer = audio; src.connect(off.destination); src.start();
    return (await off.startRendering()).getChannelData(0);
  }

  function transcribir(f32) {
    return new Promise((res, rej) => {
      const w = nacerWorker();
      const alMensaje = e => {
        const m = e.data;
        if (m.tipo === 'texto') { limpiar(); res(m.texto); }
        if (m.tipo === 'error' && m.fase === 'transcribir') { limpiar(); rej(new Error(m.msg)); }
      };
      function limpiar() { w.removeEventListener('message', alMensaje); }
      w.addEventListener('message', alMensaje);
      w.postMessage({ tipo: 'transcribir', datos: f32 }, [f32.buffer]);
    });
  }

  // ---- Insercion en el textarea -----------------------------------------------------------
  // Se inserta en el cursor, o al final si el campo no tiene foco. NUNCA se pisa lo ya escrito:
  // el geologo puede haber tecleado la mitad y dictar el resto.
  function insertar(ta, texto) {
    if (!texto) return;
    const ini = ta.selectionStart;
    const hayCursor = document.activeElement === ta && ini != null;
    if (hayCursor) {
      // Si hay una SELECCION, se inserta al principio de ella en vez de reemplazarla. Un editor
      // normal reemplazaria (dictar seria como teclear), pero en terreno una seleccion suele ser
      // accidental -- dedo gordo, guantes, pantalla mojada -- y perder texto ya escrito es mucho
      // peor que quedarse con texto de mas, que se borra en dos toques.
      const antes = ta.value.slice(0, ini), despues = ta.value.slice(ini);
      // Separadores a ambos lados: sin el de la derecha, dictar en medio de una frase pega la
      // ultima palabra con la siguiente ("porfidicagris").
      const sepIzq = antes && !/\s$/.test(antes) ? ' ' : '';
      const sepDer = despues && !/^\s/.test(despues) ? ' ' : '';
      ta.value = antes + sepIzq + texto + sepDer + despues;
      const pos = (antes + sepIzq + texto).length;
      ta.setSelectionRange(pos, pos);
    } else {
      ta.value += (ta.value && !/\n$/.test(ta.value) ? '\n' : '') + texto;
    }
    // Por si algun consumidor escucha 'input' (la PWA light lee .value directo, pero otra app
    // podria enganchar un autoguardado).
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- Boton de microfono -----------------------------------------------------------------
  function montarBoton(textarea, opts) {
    opts = opts || {};
    const aviso = opts.aviso || (m => { try { console.log('[voz]', m); } catch {} });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = opts.clase || 'btn sec mini';
    let rec = null, trozos = [], t0 = 0, cronometro = null;

    const pinta = (txt, activo) => { btn.textContent = txt; btn.disabled = !!opts.deshabilitado; btn.dataset.vozActivo = activo ? '1' : ''; };
    const reposo = () => { clearInterval(cronometro); pinta('🎤', false); btn.disabled = false; };

    async function asegurarModelo() {
      if (_estado === 'listo') return true;
      if (!(await estaDescargado())) {
        if (!confirm('El dictado necesita descargar el motor de voz (~78 MB). Es una sola vez y '
                   + 'requiere conexión; después funciona sin señal en terreno.\n\n¿Descargar ahora?')) return false;
        if (!navigator.onLine) { aviso('Sin conexión: no se puede descargar el motor ahora'); return false; }
      }
      pinta('⏳', false); btn.disabled = true;
      try {
        await cargar(p => { if (opts.onProgreso) opts.onProgreso(p); else pinta('⏳ ' + Math.round(p.pct) + '%', false); });
        return true;
      } catch (e) { aviso('No se pudo preparar el dictado: ' + e.message); return false; }
      finally { reposo(); }
    }

    btn.addEventListener('click', async () => {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      if (!(await asegurarModelo())) return;

      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { aviso('No se pudo usar el micrófono: ' + e.message); return; }

      trozos = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = e => e.data.size && trozos.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        clearInterval(cronometro);
        pinta('⏳', false); btn.disabled = true;
        try {
          const texto = await transcribir(await aFloat32(new Blob(trozos)));
          if (texto) insertar(textarea, texto);
          else aviso('No se entendió nada — probá hablar más cerca del micrófono');
        } catch (e) { aviso('No se pudo transcribir: ' + e.message); }
        finally { reposo(); }
      };
      rec.start();
      t0 = Date.now();
      const tic = () => {
        const s = Math.floor((Date.now() - t0) / 1000);
        pinta('⏹ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), true);
      };
      tic(); cronometro = setInterval(tic, 1000);
    });

    reposo();
    return btn;
  }

  // Transcribe un audio ya grabado (Blob/File). Es el mismo camino que usa el boton, expuesto
  // aparte: sirve para transcribir una nota de voz existente y para poder probar el modulo de
  // punta a punta sin depender de que alguien hable frente al microfono.
  async function transcribirBlob(blob) {
    await cargar();
    return transcribir(await aFloat32(blob));
  }

  window.VozTerreno = { configurar, estado, estaDescargado, tamanoEnDisco, descargar, borrar,
                        montarBoton, insertar, transcribirBlob };
})();
