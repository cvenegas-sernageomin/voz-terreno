const VozUI = (() => {
  const CSS = `
    .voz-btn-mic {
      background:#6c757d; color:#fff; border:none; border-radius:50%;
      width:36px; height:36px; font-size:16px; cursor:pointer;
      margin-left:6px; vertical-align:middle; flex-shrink:0;
    }
    .voz-btn-mic[data-estado="grabando"]    { background:#dc3545; animation:voz-pulse 1s infinite; }
    .voz-btn-mic[data-estado="procesando"] { background:#ffc107; color:#333; cursor:default; }
    .voz-btn-libre {
      background:#0d6efd; color:#fff; border:none; border-radius:8px;
      padding:8px 16px; font-size:14px; cursor:pointer; margin-bottom:12px;
      display:block; width:100%;
    }
    .voz-btn-libre[data-estado="grabando"]    { background:#dc3545; animation:voz-pulse 1s infinite; }
    .voz-btn-libre[data-estado="procesando"] { background:#ffc107; color:#333; cursor:default; }
    .voz-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.55);
      display:flex; align-items:center; justify-content:center; z-index:9999;
    }
    .voz-panel {
      background:#fff; border-radius:14px; padding:20px;
      max-width:92vw; width:400px; max-height:80vh; overflow-y:auto;
    }
    @media (prefers-color-scheme:dark) {
      .voz-panel { background:#1e1e2e; color:#cdd6f4; }
      .voz-panel input { background:#313244; color:#cdd6f4; border-color:#45475a; }
    }
    .voz-panel h4 { margin:0 0 12px; font-size:1rem; }
    .voz-campo-r  { margin-bottom:10px; }
    .voz-campo-r label { display:block; font-size:11px; color:#888; margin-bottom:2px; }
    .voz-campo-r input { width:100%; padding:7px 8px; border:1px solid #ddd; border-radius:7px; box-sizing:border-box; }
    .voz-baja-conf input { border-color:#ffc107; background:#fffbea; }
    .voz-panel-acc { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
    .voz-btn-cancel { padding:8px 14px; border:1px solid #ccc; background:transparent; border-radius:7px; cursor:pointer; }
    .voz-btn-apply  { padding:8px 14px; background:#0d6efd; color:#fff; border:none; border-radius:7px; cursor:pointer; }
    .voz-descarga {
      position:fixed; bottom:16px; right:16px;
      background:#333; color:#fff; padding:10px 14px;
      border-radius:10px; font-size:13px; z-index:9998; max-width:260px;
    }
    @keyframes voz-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
  `;

  let _cssInjected = false;
  function inyectarCSS() {
    if (_cssInjected) return;
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    _cssInjected = true;
  }

  function crearBotonMic(campoId, label, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "voz-btn-mic";
    btn.dataset.estado = "idle";
    btn.dataset.campo = campoId;
    btn.innerHTML = "🎤";
    btn.title = "Dictar: " + label;
    btn.addEventListener("click", () => onClick(campoId));
    return btn;
  }

  function setEstadoBtn(btn, estado) {
    const iconos = { idle:"🎤", grabando:"⏹", procesando:"⏳", error:"❌" };
    btn.dataset.estado = estado;
    btn.innerHTML = iconos[estado] || "🎤";
    btn.disabled = estado === "procesando";
  }

  function mostrarPanelRevision(resultados, onConfirmar, onCancelar) {
    const overlay = document.createElement("div");
    overlay.className = "voz-overlay";
    overlay.innerHTML = `
      <div class="voz-panel">
        <h4>📋 Campos detectados — revisa antes de aplicar</h4>
        ${resultados.map(r => `
          <div class="voz-campo-r ${r.confianza < 0.7 ? "voz-baja-conf" : ""}">
            <label>${r.label}${r.confianza < 0.7 ? " ⚠️" : ""}</label>
            <input type="text" data-campo-id="${r.campoId}" value="${r.valor}">
          </div>
        `).join("")}
        <div class="voz-panel-acc">
          <button class="voz-btn-cancel">Cancelar</button>
          <button class="voz-btn-apply">Aplicar</button>
        </div>
      </div>
    `;
    overlay.querySelector(".voz-btn-cancel").onclick = () => { overlay.remove(); onCancelar?.(); };
    overlay.querySelector(".voz-btn-apply").onclick = () => {
      const vals = {};
      overlay.querySelectorAll("[data-campo-id]").forEach(inp => { vals[inp.dataset.campoId] = inp.value; });
      overlay.remove();
      onConfirmar(vals);
    };
    document.body.appendChild(overlay);
  }

  function mostrarDialogoAprendizaje(termino, label, valorSugerido, onGuardar) {
    const ok = confirm(`"${termino}" no reconocido en ${label}.\n¿Guardar como "${valorSugerido}" para futuros dictados?`);
    if (ok) onGuardar(termino, valorSugerido);
  }

  let _barraDesc = null;
  function mostrarProgresoDescarga(info) {
    if (!_barraDesc) {
      _barraDesc = document.createElement("div");
      _barraDesc.className = "voz-descarga";
      document.body.appendChild(_barraDesc);
    }
    const pct = info.progress != null ? Math.round(info.progress) + "%" : "...";
    _barraDesc.textContent = `🔊 Descargando motor de voz (${pct}, 244 MB, solo esta vez)`;
  }

  function ocultarProgresoDescarga() { _barraDesc?.remove(); _barraDesc = null; }

  return { inyectarCSS, crearBotonMic, setEstadoBtn, mostrarPanelRevision,
           mostrarDialogoAprendizaje, mostrarProgresoDescarga, ocultarProgresoDescarga };
})();
