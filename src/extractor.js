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
