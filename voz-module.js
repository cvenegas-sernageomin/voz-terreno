/* voz-module.js - VozTerreno 2026-07-07 */

// vocabulario.js — Módulos geológicos + VocabularioLocal
// Parte del bundle voz-module.js (concatenado por build.ps1)

const VOZ_MODULOS = {
  igneas: [
    'granito', 'granodiorita', 'tonalita', 'monzogranito', 'diorita',
    'gabro', 'norita', 'peridotita', 'dunita', 'riolita',
    'dacita', 'andesita', 'basalto', 'obsidiana', 'pumicita',
    'porfido', 'porfido riolitico', 'porfido dacitico', 'porfido andesitico',
    'ignimbrita', 'ignimbrita soldada', 'toba', 'toba vitrica', 'lapilli',
    'escorias volcanicas', 'brecha volcanica', 'aglomerado volcanico', 'lahar',
    'pegmatita', 'aplita', 'lamprofiro', 'microdiorita', 'sienita', 'monzonita'
  ],

  sedimentarias: [
    'arenisca', 'arenisca fina', 'arenisca media', 'arenisca gruesa',
    'arenisca conglomeradica', 'grauvaca', 'arcosa', 'lutita', 'pelita',
    'arcilita', 'limolita', 'fangolita', 'marga', 'conglomerado',
    'brecha sedimentaria', 'ortoconglomerado', 'paraconglomerado',
    'caliza', 'caliza olitica', 'caliza bioclastica', 'mudstone', 'wackestone',
    'dolomita', 'evaporita', 'sal', 'yeso', 'anhidrita',
    'chert', 'silex', 'carbon', 'lignito', 'diatomita', 'bentonita'
  ],

  metamorficas: [
    'esquisto', 'esquisto verde', 'esquisto azul', 'filita',
    'gneis', 'gneis granitico', 'gneis bandeado', 'pizarra',
    'corneana', 'marmol', 'cuarcita', 'anfibolita', 'eclogita',
    'granulita', 'serpentinita', 'milonita', 'cataclasite',
    'brecha de falla', 'skarn'
  ],

  cuaternario: [
    'deposito aluvial', 'aluvio', 'deposito fluvial', 'planicie aluvial',
    'terraza fluvial', 'deposito coluvial', 'coluvio', 'coluvio aluvio',
    'deposito de ladera', 'deposito de remocion en masa',
    'deposito de deslizamiento', 'deposito de flujo de detritos',
    'deposito de flujo de lodo', 'deposito de caida de rocas',
    'talud de detritos', 'deposito glacial', 'morrena', 'till', 'lahar',
    'deposito lacustre', 'suelo', 'tierra vegetal', 'relleno antropico'
  ],

  varnes: [
    'caida de roca', 'caida de detritos', 'caida de suelo',
    'vuelco de roca', 'vuelco de detritos',
    'deslizamiento rotacional en roca', 'deslizamiento rotacional en suelo',
    'deslizamiento traslacional en roca', 'deslizamiento traslacional en detritos',
    'deslizamiento traslacional en suelo', 'deslizamiento en cuña',
    'expansion lateral en roca', 'expansion lateral en suelo',
    'flujo de detritos', 'crecida de detritos', 'aluvion',
    'flujo de lodo', 'flujo de tierra', 'avalancha de roca',
    'reptacion de suelo', 'solifluxion', 'movimiento complejo'
  ],

  isrm: [
    'W1', 'W1 fresca', 'fresca', 'sin alteracion visible', 'roca fresca',
    'W2', 'W2 ligeramente meteorizada', 'ligeramente meteorizada', 'ligeramente alterada',
    'W3', 'W3 moderadamente meteorizada', 'moderadamente meteorizada',
    'W4', 'W4 muy meteorizada', 'muy meteorizada',
    'W5', 'W5 completamente meteorizada', 'completamente meteorizada',
    'suelo residual', 'hidrotermal leve', 'silicificacion',
    'hidrotermal moderada', 'arcillizacion parcial', 'hidrotermal intensa'
  ],

  estructural: [
    'falla normal', 'falla inversa', 'falla de desgarre', 'falla transcurrente',
    'pliegue', 'anticlinal', 'sinclinal', 'homoclinal',
    'diaclasa', 'fractura', 'veta', 'dique',
    'foliacion', 'esquistosidad', 'lineacion',
    'contacto normal', 'contacto fallado', 'discordancia angular',
    'rumbo', 'manteo', 'buzamiento'
  ],

  alteracion: [
    'alteracion propilitica', 'clorita', 'epidota',
    'alteracion argilica', 'caolin', 'montmorillonita',
    'alteracion argilica avanzada', 'alteracion filica', 'sericita',
    'alteracion potasica', 'biotita', 'alteracion silicica',
    'silice', 'fresco', 'sin alteracion'
  ]
};

/**
 * Normaliza un string: minúsculas + elimina tildes/diéresis.
 * @param {string} s
 * @returns {string}
 */
function normalizar(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[áÁ]/g, 'a')
    .replace(/[éÉ]/g, 'e')
    .replace(/[íÍ]/g, 'i')
    .replace(/[óÓ]/g, 'o')
    .replace(/[úÚüÜ]/g, 'u')
    .replace(/[ñÑ]/g, 'n');
}

/**
 * Gestiona vocabulario personalizado en localStorage.
 * Permite activar módulos temáticos, agregar términos extra,
 * y persistir correcciones voz→campo.
 */
class VocabularioLocal {
  /**
   * @param {string} appId — identificador de la PWA (ej. "catastro-remociones")
   */
  constructor(appId) {
    this._key = 'voz-vocab-' + appId;
    this._modulosActivos = [];
    this._extra = [];
    this._termNorm = null; // cache
  }

  /**
   * Activa los módulos a incluir en el vocabulario de reconocimiento.
   * @param {string[]} modulos — keys de VOZ_MODULOS
   */
  activar(modulos) {
    this._modulosActivos = modulos || [];
    this._termNorm = null;
  }

  /**
   * Agrega términos extra que no están en VOZ_MODULOS.
   * @param {string[]} items
   */
  agregarExtra(items) {
    this._extra = items || [];
    this._termNorm = null;
  }

  /**
   * Construye (y cachea) el array normalizado de términos.
   * Solo reconstruye si _termNorm === null.
   */
  _buildCache() {
    if (this._termNorm !== null) return;
    const seen = new Set();
    const result = [];
    const allTerms = [];

    for (const mod of this._modulosActivos) {
      if (VOZ_MODULOS[mod]) {
        allTerms.push(...VOZ_MODULOS[mod]);
      }
    }
    allTerms.push(...this._extra);

    for (const original of allTerms) {
      const norm = normalizar(original);
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push({ original, norm });
      }
    }
    this._termNorm = result;
  }

  /**
   * Retorna array de {original, norm} de los módulos activos + extra.
   * @returns {{ original: string, norm: string }[]}
   */
  getTerminos() {
    this._buildCache();
    return this._termNorm;
  }

  /**
   * Busca una corrección guardada para un texto reconocido.
   * @param {string} texto — texto transcrito (puede tener tildes)
   * @returns {{ campoId: string, valor: string } | null}
   */
  buscar(texto) {
    try {
      const raw = localStorage.getItem(this._key);
      const vocab = (raw ? JSON.parse(raw) : null) || {};
      return vocab[normalizar(texto)] || null;
    } catch { return null; }
  }

  /**
   * Guarda la corrección término→campo para uso futuro.
   * @param {string} termino — término reconocido
   * @param {string} campoId — campo destino en el formulario
   * @param {string} valor — valor corregido
   */
  guardar(termino, campoId, valor) {
    try {
      const raw = localStorage.getItem(this._key);
      const vocab = (raw ? JSON.parse(raw) : null) || {};
      vocab[normalizar(termino)] = { campoId, valor };
      localStorage.setItem(this._key, JSON.stringify(vocab));
    } catch { /* localStorage no disponible */ }
  }

  /**
   * Exporta el vocabulario local como archivo JSON descargable.
   */
  exportar() {
    try {
      const data = localStorage.getItem(this._key) || '{}';
      const blob = new Blob([data], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'vocabulario-' + this._key + '.json';
      a.click();
    } catch (e) { console.warn('[VozTerreno] exportar:', e.message); }
  }

  /**
   * Importa un archivo JSON y fusiona con el vocabulario existente.
   * Las claves nuevas sobreescriben las existentes.
   * @param {File} archivo
   * @returns {Promise<number>} cantidad de entradas importadas
   */
  importar(archivo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!imported || typeof imported !== 'object' || Array.isArray(imported))
            return reject(new Error('Formato inválido'));
          const raw = localStorage.getItem(this._key);
          const existing = (raw ? JSON.parse(raw) : null) || {};
          localStorage.setItem(this._key, JSON.stringify(Object.assign(existing, imported)));
          resolve(Object.keys(imported).length);
        } catch (err) { reject(err); }
      };
      reader.onerror  = () => reject(reader.error);
      reader.onabort  = () => reject(new Error('Lectura abortada'));
      reader.readAsText(archivo);
    });
  }

  /**
   * Retorna el objeto completo guardado en localStorage.
   * @returns {Object}
   */
  listar() {
    try {
      const raw = localStorage.getItem(this._key);
      return (raw ? JSON.parse(raw) : null) || {};
    } catch { return {}; }
  }
}


// extractor.js — Motores de extracción por tipo de campo geológico
// Parte del bundle voz-module.js (concatenado por build.ps1)

const Extractor = (() => {

  // 1. normalizar — duplicado de vocabulario.js (funciona standalone en tests)
  function normalizar(s) {
    if (!s) return '';
    return s.toLowerCase()
      .replace(/[áÁ]/g, 'a')
      .replace(/[éÉ]/g, 'e')
      .replace(/[íÍ]/g, 'i')
      .replace(/[óÓ]/g, 'o')
      .replace(/[úÚüÜ]/g, 'u')
      .replace(/[ñÑ]/g, 'n');
  }

  // 2. levenshtein — distancia de edición entre dos strings (DP estándar)
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = [];
    for (let i = 0; i <= m; i++) {
      dp[i] = [i];
      for (let j = 1; j <= n; j++) {
        if (i === 0) {
          dp[i][j] = j;
        } else if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }
    return dp[m][n];
  }

  // 3. fuzzyMatch — matching difuso contra lista de términos
  // terminos: array de strings planos O de {original, norm}
  // Retorna {valor, confianza} o null
  function fuzzyMatch(texto, terminos) {
    const textoNorm = normalizar(texto);
    let bestScore = 0;
    let bestValor = null;

    // Fix 4: collect ALL substring matches, return the most specific (longest norm)
    let bestSubstr = null;
    let bestSubstrLen = -1;

    for (const t of terminos) {
      const original = typeof t === 'string' ? t : t.original;
      const norm = typeof t === 'string' ? normalizar(t) : t.norm;

      // Primer paso: substring exacto → recopilar todos, elegir el más largo
      if (textoNorm.includes(norm)) {
        if (norm.length > bestSubstrLen) {
          bestSubstrLen = norm.length;
          bestSubstr = { valor: original, confianza: 1.0 };
        }
        continue;
      }

      // Segundo paso: word-by-word fuzzy
      const textoWords = textoNorm.split(/\s+/).filter(w => w.length > 0);
      const termWords = norm.split(/\s+/).filter(w => w.length > 0);
      if (termWords.length === 0) continue;

      let matchCount = 0;
      for (const tw of termWords) {
        for (const txw of textoWords) {
          const maxLen = Math.max(tw.length, txw.length);
          if (maxLen === 0) continue;
          if (levenshtein(tw, txw) / maxLen <= 0.35) {
            matchCount++;
            break;
          }
        }
      }

      const score = matchCount / termWords.length;
      if (score > bestScore) {
        bestScore = score;
        bestValor = original;
      }
    }

    // Return most specific substring match if any were found
    if (bestSubstr !== null) return bestSubstr;

    return bestScore >= 0.5 ? { valor: bestValor, confianza: bestScore } : null;
  }

  // 4. extraerAngulo — extrae un ángulo numérico o en palabras españolas
  // rango: [min, max] opcional
  // Retorna {valor: number, confianza} o null
  function extraerAngulo(texto, rango) {
    const t = normalizar(texto);

    // Regex: dígito(s) seguido de °, grado(s) o grad
    const mNum = t.match(/(\d+(?:[.,]\d+)?)\s*(?:°|grados?|grad\b)/);
    if (mNum) {
      const val = parseFloat(mNum[1].replace(',', '.'));
      if (rango && (val < rango[0] || val > rango[1])) return null;
      return { valor: val, confianza: 0.95 };
    }

    // Fix 1: compound Spanish numbers (teens + contracted 21-29)
    const compuestos = {
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19,
      'veintiuno': 21, 'veintidos': 22, 'veintitres': 23, 'veinticuatro': 24,
      'veinticinco': 25, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28,
      'veintinueve': 29
    };
    for (const word of t.split(/\s+/)) {
      if (compuestos[word] !== undefined) {
        const val = compuestos[word];
        if (rango && (val < rango[0] || val > rango[1])) return null;
        return { valor: val, confianza: 0.8 };
      }
    }

    // Palabras: decenas y unidades opcionales
    const decenas = {
      'cero': 0, 'diez': 10, 'veinte': 20, 'treinta': 30, 'cuarenta': 40,
      'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90
    };
    const unidades = {
      'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
    };

    // Segundo paso: "decena y unidad" (ej. "treinta y cinco")
    for (const [dec, decVal] of Object.entries(decenas)) {
      const mDY = t.match(new RegExp('\\b' + dec + '\\s+y\\s+(\\w+)'));
      if (mDY && unidades[mDY[1]] !== undefined) {
        const val = decVal + unidades[mDY[1]];
        if (rango && (val < rango[0] || val > rango[1])) return null;
        return { valor: val, confianza: 0.8 };
      }
    }

    // Tercer paso: solo decena (ej. "treinta grados")
    for (const [dec, decVal] of Object.entries(decenas)) {
      if (new RegExp('\\b' + dec + '\\b').test(t)) {
        if (rango && (decVal < rango[0] || decVal > rango[1])) return null;
        return { valor: decVal, confianza: 0.8 };
      }
    }

    return null;
  }

  // 5. extraerNumero — extrae el primer número entero o decimal del texto
  // Retorna {valor: number, confianza: 0.9} o null
  function extraerNumero(texto, rango) {
    const t = normalizar(texto);
    const m = t.match(/\d+(?:[.,]\d+)?/);
    if (!m) return null;
    const val = parseFloat(m[0].replace(',', '.'));
    if (rango && (val < rango[0] || val > rango[1])) return null;
    return { valor: val, confianza: 0.9 };
  }

  // 6. extraerISRM — mapea keywords al grado de meteorización ISRM
  // Retorna {valor: string, confianza: 0.95} o null
  function extraerISRM(texto) {
    const t = normalizar(texto);

    const mappings = [
      {
        keywords: ['w1', 'fresca', 'sin alteracion visible', 'roca fresca'],
        valor: 'W1 – Fresca (sin alteración visible)'
      },
      {
        keywords: ['w2', 'ligeramente meteor', 'ligeramente alter'],
        valor: 'W2 – Ligeramente meteorizada'
      },
      {
        keywords: ['w3', 'moderadamente meteor', 'moderadamente alter'],
        valor: 'W3 – Moderadamente meteorizada'
      },
      {
        keywords: ['w4', 'muy meteor', 'muy alter'],
        valor: 'W4 – Muy meteorizada'
      },
      {
        keywords: ['w5', 'completamente meteorizada', 'suelo residual'],
        valor: 'W5 – Completamente meteorizada (suelo residual)'
      },
      {
        keywords: ['hidrotermal leve', 'silicificacion', 'carbonatacion'],
        valor: 'Hidrotermal leve (silicificación o carbonatación débil)'
      },
      {
        keywords: ['hidrotermal moderada', 'arcillizacion parcial'],
        valor: 'Hidrotermal moderada (arcillización parcial)'
      },
      {
        keywords: ['hidrotermal intensa', 'arcillizacion total'],
        valor: 'Hidrotermal intensa (arcillización total, clays dominantes)'
      }
    ];

    for (const mapping of mappings) {
      for (const kw of mapping.keywords) {
        const normKw = normalizar(kw);
        // Fix 3: use word-boundary regex for bare W-codes to avoid partial matches
        let matches;
        if (/^w[12345]$/.test(normKw)) {
          matches = new RegExp('\\b' + normKw + '\\b').test(t);
        } else {
          matches = t.includes(normKw);
        }
        if (matches) {
          return { valor: mapping.valor, confianza: 0.95 };
        }
      }
    }
    return null;
  }

  // 7. extraerCampo — extrae un campo según su tipo y configuración
  // campoConfig: {id, tipo, valores?, rango?}
  // vocabulario: instancia de VocabularioLocal
  // Retorna {valor, confianza} o null
  function extraerCampo(texto, campoConfig, vocabulario) {
    // 1. Buscar en vocabulario aprendido
    const aprendido = vocabulario.buscar(texto);
    if (aprendido && aprendido.campoId === campoConfig.id) {
      return { valor: aprendido.valor, confianza: 1.0 };
    }

    // 2. Delegar según tipo
    switch (campoConfig.tipo) {
      case 'angulo':
        return extraerAngulo(texto, campoConfig.rango);
      case 'numero':
        return extraerNumero(texto, campoConfig.rango);
      case 'isrm':
        return extraerISRM(texto);
      case 'texto_libre':
        return { valor: texto.trim(), confianza: 1.0 };
      case 'clasificacion':
        if (campoConfig.valores) {
          return fuzzyMatch(
            texto,
            campoConfig.valores.map(v => ({ original: v, norm: normalizar(v) }))
          );
        }
        return null;
      case 'litologia':
        return fuzzyMatch(texto, vocabulario.getTerminos());
      default:
        return null;
    }
  }

  // 8. extraerMultiple — extrae múltiples campos de un texto
  // Omite campos tipo "texto_libre"
  // Retorna array de {campoId, label, valor, confianza} con confianza >= 0.5
  function extraerMultiple(texto, campos, vocabulario) {
    const results = [];
    for (const campo of campos) {
      if (campo.tipo === 'texto_libre') continue;
      const result = extraerCampo(texto, campo, vocabulario);
      if (result && result.confianza >= 0.5) {
        results.push({
          campoId: campo.id,
          label: campo.label,
          valor: result.valor,
          confianza: result.confianza
        });
      }
    }
    return results;
  }

  return {
    normalizar,
    levenshtein,
    fuzzyMatch,
    extraerAngulo,
    extraerNumero,
    extraerISRM,
    extraerCampo,
    extraerMultiple
  };

})();


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
