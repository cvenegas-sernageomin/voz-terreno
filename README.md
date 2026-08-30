# VozTerreno — dictado por voz 100% offline

Módulo de dictado para las PWAs de geología de terreno. Se descarga una vez con conexión (en la
oficina, por wifi) y después transcribe **sin señal**, que es la situación real en terreno.

Motor: Whisper base cuantizado sobre Transformers.js, corriendo en el navegador. Nada se envía a
ningún servidor: el audio no sale del teléfono.

---

## Cómo se integra en una PWA

Dos pasos:

1. Copiar `vendor/voz/` dentro de la app (`npm run vendorizar` deja el runtime listo).
2. En el HTML:

```html
<script src="vendor/voz/voz.js"></script>
<script>
  // Crea el botón 🎤 y hace todo: pide permiso, graba, transcribe e inserta en el textarea.
  miBarraDeBotones.append(VozTerreno.montarBoton(miTextarea));
</script>
```

**No agregar el runtime a la lista `ASSETS` del Service Worker.** Son ~21 MB y el `install` los
bajaría en todos los dispositivos aunque el geólogo nunca dicte. Se siguen cacheando solos por la
rama cache-first la primera vez que se usan — que es durante la descarga, con conexión. Es el
mismo criterio que ya se usa con `gdal3.js`.

### API

| | |
|---|---|
| `VozTerreno.montarBoton(textarea, opts)` | Devuelve un `<button>` ya enganchado. `opts`: `clase`, `aviso(msg)`, `onProgreso({archivo,pct})` |
| `VozTerreno.descargar(onProgreso)` | Baja el modelo (~78 MB). Pide almacenamiento persistente |
| `VozTerreno.estaDescargado()` | `true` si ya está en el dispositivo |
| `VozTerreno.tamanoEnDisco()` | Bytes que ocupa |
| `VozTerreno.borrar()` | Lo saca del dispositivo |
| `VozTerreno.transcribirBlob(blob)` | Transcribe un audio ya grabado |
| `VozTerreno.insertar(ta, texto)` | Inserta en el cursor sin pisar lo escrito |
| `VozTerreno.configurar({modelo, modeloId})` | Cambia de dónde sale el modelo |

---

## Dónde vive cada cosa, y por qué

| | Dónde | Peso |
|---|---|---|
| **Modelo** | publicado en `/voz-terreno/modelo/`, una sola copia | ~78 MB |
| **Runtime** | copiado dentro de `vendor/voz/` de **cada** PWA | ~21 MB |

El **modelo** va en un solo lugar porque Transformers.js lo guarda en la Cache API, que tiene
alcance de **origen**: como todas las PWAs viven en `cvenegas-sernageomin.github.io`, se baja una
sola vez y las demás ya lo encuentran descargado.

El **runtime** se copia en cada app porque el Service Worker de cada una solo controla su propio
path. Servido desde `/voz-terreno/`, quedaría a merced de la caché HTTP (corta en GitHub Pages) y
podría faltar justo en terreno.

---

## Dos bugs que hay que conocer antes de tocar esto

La versión anterior de este módulo **nunca pudo funcionar**, y el diagnóstico costó caro: se
integró en la PWA de remociones en masa y hubo que retirarla entera en su v22 por un
`Unexpected token 'export'` que nadie logró explicar. Las causas, ya confirmadas:

1. **El worker se creaba desde un Blob, concatenando el bundle ESM de Transformers en un worker
   clásico.** Un worker clásico no entiende `export`, de ahí el error. Además leía un global
   `self.Transformers` que el build ESM nunca crea.
   → **Ahora el worker se carga desde su URL real, con `{type:'module'}`.** Eso además evita el
   otro problema conocido de los workers-desde-blob: no resuelven rutas relativas.

2. **Los binarios de onnxruntime se bajaban de `cdn.jsdelivr.net` en tiempo de ejecución**, porque
   nadie sobreescribió `env.backends.onnx.wasm.wasmPaths`. Aunque el worker hubiera cargado, la
   app habría necesitado internet en terreno. Nunca se llegó a ver porque el bug 1 abortaba antes.
   → **Ahora los `.wasm` van vendorizados** y `wasmPaths` apunta al lado del worker.

Como red de seguridad se usa `env.allowRemoteModels = false`: si una ruta queda mal, falla
**ruidosamente** en vez de bajar el modelo de HuggingFace por atrás y "funcionar" hasta que el
geólogo se quede sin señal.

### Versión de Transformers.js: 3.x, no 4.x

Está fijada en `3.8.1` a propósito. La **4.x no sirve**: su onnxruntime (1.26-dev) no puede abrir
los pesos Whisper cuantizados y falla con `TransposeDQWeightsForMatMulNBits Missing required
scale`, tanto con los modelos de `Xenova` como con los de `onnx-community`. `scripts/vendorizar.mjs`
aborta si detecta una 4.x, para que nadie lo suba sin querer.

Del bundle hay que usar **`transformers.min.js`**, no `transformers.web.min.js`: el "web" trae
imports pelados (`onnxruntime-common`) que el navegador no resuelve sin un *import map*, y en un
Worker no hay forma de darle uno.

De onnxruntime solo hace falta la variante **jsep**; la otra sobra (verificado quitándola).

---

## Desarrollo

```bash
npm install          # instala Transformers.js 3.8.1 (versión fijada)
npm run preparar     # vendoriza el runtime + baja el modelo
python -m http.server 8850
```

- `demo.html` — el módulo tal como queda en la PWA (botón, descarga, inserción).
- `spike.html` — diagnóstico de más bajo nivel: registra cada archivo que se pide y **bloquea
  cualquier pedido a un origen externo**, para comprobar que el offline es real y no un espejismo
  de la oficina con wifi.

`modelo/` y el runtime vendorizado no se versionan en `main` (se regeneran con `npm run preparar`);
viven en la rama `gh-pages`, que es lo que se publica.

### Calidad esperada

Con audio limpio, whisper-base acierta el vocabulario geológico técnico —*propilítica*,
*afanítica*, *fenocristales*, *subredondeados*— con acentuación correcta. Falla sobre todo en la
**separación de palabras** (*plagio clasa* por *plagioclasa*) y en plurales. En terreno, con viento
y prisa, va a ser peor: conviene medirlo con voz real antes de sacar conclusiones.
