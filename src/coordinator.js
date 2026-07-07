const VozTerreno = (() => {
  const BASE_URL = "https://cvenegas-sernageomin.github.io/voz-terreno";

  let _config = null;
  let _vocab  = null;
  let _worker = null;
  let _recorder = null;
  let _chunks    = [];
  let _grabando  = false;
  let _campoActivo = null;
  const _botones = {};

  // --- Worker lifecycle ---

  async function _fetchCached(url) {
    const cached = await caches.match(url);
    return cached || fetch(url);
  }

  async function _iniciarWorker() {
    const [workerCode, tfCode] = await Promise.all([
      _fetchCached(BASE_URL + "/whisper-worker.js").then(r => r.text()),
      _fetchCached(BASE_URL + "/transformers.min.js").then(r => r.text()),
    ]);
    const blob = new Blob([tfCode + "\n" + workerCode], { type: "application/javascript" });
    _worker = new Worker(URL.createObjectURL(blob));
    _worker.onmessage = _onWorkerMsg;
    _worker.onerror   = e => console.error("[VozTerreno] Worker error:", e.message);
    _worker.postMessage({ tipo: "cargar" });
  }

  function _onWorkerMsg(e) {
    const msg = e.data;
    if (msg.tipo === "progreso")      VozUI.mostrarProgresoDescarga(msg);
    if (msg.tipo === "modelo-listo")  VozUI.ocultarProgresoDescarga();
    if (msg.tipo === "transcripcion") _onTranscripcion(msg.texto);
    if (msg.tipo === "error")         { console.error("[VozTerreno]", msg.msg); _resetEstado(); }
  }

  // --- Grabación ---

  async function _iniciarGrabacion(campoId) {
    if (_grabando) { _detenerGrabacion(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000 } }); }
    catch(e) { alert("Sin acceso al micrófono: " + e.message); return; }

    _chunks = [];
    _recorder = new MediaRecorder(stream);
    _recorder.ondataavailable = e => _chunks.push(e.data);
    _recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      _setEstadoTodos("procesando");
      try {
        const blob = new Blob(_chunks, { type: "audio/webm" });
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const decoded  = await audioCtx.decodeAudioData(arrayBuffer);
        const float32  = decoded.getChannelData(0);
        _worker.postMessage({ tipo: "transcribir", datos: float32 }, [float32.buffer]);
      } catch(e) {
        console.error("[VozTerreno] Error decodificando audio:", e);
        _resetEstado();
      }
    };
    _recorder.start();
    _grabando = true;
    _campoActivo = campoId;
    const btn = _botones[campoId];
    if (btn) VozUI.setEstadoBtn(btn, "grabando");
  }

  function _detenerGrabacion() {
    if (_recorder && _grabando) { _recorder.stop(); _grabando = false; }
  }

  function _resetEstado() {
    _grabando = false;
    _campoActivo = null;
    _setEstadoTodos("idle");
  }

  function _setEstadoTodos(estado) {
    Object.values(_botones).forEach(btn => { if (btn) VozUI.setEstadoBtn(btn, estado); });
  }

  // --- Transcripción recibida ---

  function _onTranscripcion(texto) {
    if (!texto) { _resetEstado(); return; }

    if (_campoActivo === "__libre__") {
      const resultados = Extractor.extraerMultiple(texto, _config.campos, _vocab);
      if (resultados.length === 0) {
        alert("No se detectaron campos en:\n\"" + texto + "\"");
        _resetEstado();
        return;
      }
      VozUI.mostrarPanelRevision(
        resultados,
        vals => {
          Object.entries(vals).forEach(([id, val]) => _config.onFill(id, val));
          _resetEstado();
        },
        _resetEstado
      );
    } else {
      const campo = _config.campos.find(c => c.id === _campoActivo);
      if (!campo) { _resetEstado(); return; }
      const resultado = Extractor.extraerCampo(texto, campo, _vocab);

      if (resultado && resultado.confianza >= 0.7) {
        _config.onFill(_campoActivo, resultado.valor);
        _resetEstado();
      } else if (resultado && resultado.confianza >= 0.5) {
        VozUI.mostrarDialogoAprendizaje(
          texto, campo.label, resultado.valor,
          (termino, valor) => _vocab.guardar(termino, campo.id, valor)
        );
        _config.onFill(_campoActivo, resultado.valor);
        _resetEstado();
      } else {
        // Sin coincidencia: llenar con texto crudo para que el usuario corrija
        _config.onFill(_campoActivo, texto);
        _resetEstado();
      }
    }
  }

  // --- API pública ---

  function init(config) {
    _config = config;
    _vocab  = new VocabularioLocal(config.appId);
    _vocab.activar(config.modulos || []);
    _vocab.agregarExtra(config.vocabulario_extra || []);
    VozUI.inyectarCSS();
    _iniciarWorker().catch(e => console.error("[VozTerreno] No se pudo iniciar worker:", e));
  }

  // container: elemento DOM que contiene los campos del formulario
  function renderUI(container) {
    if (!container || !_config) return;

    // Botón dictado libre (solo si no existe ya)
    if (!container.querySelector(".voz-btn-libre")) {
      const btnLibre = document.createElement("button");
      btnLibre.type = "button";
      btnLibre.className = "voz-btn-libre";
      btnLibre.innerHTML = "🎤 Dictado libre";
      btnLibre.dataset.estado = "idle";
      btnLibre.addEventListener("click", () =>
        _grabando ? _detenerGrabacion() : _iniciarGrabacion("__libre__")
      );
      container.insertBefore(btnLibre, container.firstChild);
      _botones["__libre__"] = btnLibre;
    }

    // Botones por campo
    _config.campos.forEach(campo => {
      if (_botones[campo.id]) return; // ya tiene botón
      const input = container.querySelector("#" + campo.id + ", [name='" + campo.id + "']");
      if (!input) return;
      const btn = VozUI.crearBotonMic(campo.id, campo.label, id =>
        _grabando ? _detenerGrabacion() : _iniciarGrabacion(id)
      );
      input.parentNode.insertBefore(btn, input.nextSibling);
      _botones[campo.id] = btn;
    });
  }

  return { init, renderUI };
})();
