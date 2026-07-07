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
