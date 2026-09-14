# Vídeos explicativos desde CodeDoc Archive: qué hay, qué falta y por dónde entrar

Discovery del 14/09/2026, de 13:00 a 14:30. Solo lectura sobre el repo; lo instalado y medido vive en el
scratchpad de la sesión y no toca el proyecto. Todo lo comprobado lleva fecha; lo que no se pudo
comprobar va con `⚠ sin verificar` y lo que buscamos para afirmarlo.

**Alcance.** Entra: qué necesita un vídeo de CDA y si el plan lo da; cinco vías de pipeline de guion
a MP4 (las tres familias pedidas, la nube de vídeo y la voz humana que propusiste a las 13:45),
medidas en esta máquina; voz en castellano local y en nube; el orquestador; el inventario de la
máquina. Queda fuera: diseñar el pipeline, elegir la voz (eso lo decides tú
oyendo), y cualquier cambio al repo.

**Criterio de éxito del documento.** Que con él puedas decidir si haces el prototipo de la sección 5
sin más preguntas. Los números medidos van antes que la prosa.

## 0. Lo medido hoy, en esta máquina, antes de nada

Máquina: Ryzen 7 5800X (8 núcleos, 16 hilos), 64 GB de RAM, RTX 3070 con 8.192 MiB de los que el
escritorio ocupa 1.670 (`nvidia-smi`, 13:04), 984 GB libres en C: y 231 en F:. Bloque de prueba:
`memory_search`, `naeth/app/mcp_server.py:384-443`, que es el ejemplo canónico 5.3 de la guía
(`docs/guia-documentacion.md:168-211`).

| Pieza | Herramienta y versión | Resultado medido (14/09/2026) |
|---|---|---|
| Voz local, CPU | Piper 1.8.0, voz `es_ES-davefx-medium` | 161 palabras: 64,9 s de audio en 2,76 s (RTF 0,043). Carga 2,8 s. Tiempos por frase gratis (un chunk por frase). Alineación por fonema: `None` aunque se pida con `include_alignments=True` (esa voz no la trae). |
| Voz local, GPU | Kokoro 0.9.4, voces `ef_dora` y `em_alex` | 161 palabras: 58,4 s en 3,29 s en frío, 989 MiB de VRAM. Frase a frase en caliente: 13 frases, 69,2 s en 2,54 s, 764 MiB. Guion de 265 palabras: 94 s de audio en 7,5 s. Sin marcas de tiempo en castellano (los tokens llegan vacíos). |
| Alineación por palabra | torchaudio 2.11 `MMS_FA` en GPU | 151 palabras alineadas en 0,94 s, 2.634 MiB de VRAM. ⚠ Pesos CC-BY-NC 4.0: vale para ti, no para vender. |
| Guion | `claude -p --model sonnet --output-format json --json-schema` | 16 frases con rango de líneas y tipo de plano, en 90 s de pared (87,9 s de modelo, 2 turnos). Coste nominal 0,36 USD: 64.598 tokens de entrada (el contexto entero de Claude Code, no el bloque, que son 5.047 caracteres) y 10.305 de salida, 8.957 de ellos pensamiento. |
| Render programático | Remotion 4.0.524 | 65,3 s de vídeo 1080p30 en 50 s de pared; 139,9 s en 131 s. Con `--concurrency=8` empeora a 82 s. MP4 h264 más AAC, 4,8 y 9,8 MB. |
| Render HTML | Hyperframes 0.8.38 | Instalación 36 s; su Chrome, 6 s; 10 s en blanco a 1080p30 en 14,5 s (captura por GPU 10,9 s). |
| Grabación del visor | Playwright 1.63.0 sobre el headless shell 151 ya en caché | 11,5 s de `#/grafo` en 13 s de pared, WebM VP8 a 25 fps fijos, sin audio, 1,16 MB. A MP4 con `h264_nvenc` en 1 s. |
| Aristas de llamada | `ast` de la stdlib sobre `naeth/app` | 99 funciones, 106 aristas `llama_a` resueltas en 0,032 s. |
| El vídeo entero | guion de `claude -p` + Kokoro + Remotion | 2 min 20 s, de bloque a MP4 sin tocar nada a mano, montado entre las 13:05 y las 13:20. |

| Voz local, GPU, calidad | Qwen3-TTS 1.7B CustomVoice (`qwen-tts` 0.1.1), voz `ryan` | En limpio, 3 frases: 26,5 s de audio en 88,8 s (RTF 3,35), 4.372 MiB de VRAM, carga 5,8 s. El guion entero (265 palabras, 164,7 s de audio) tardó 19 min compartiendo GPU con Chatterbox. Descartada: por tu oído y por tiempo. |
| Voz local, GPU, calidad | Chatterbox Multilingual (`chatterbox-tts` 0.1.7), `language_id='es'` | En limpio: 26 frases, 106,0 s de audio en 155,4 s (RTF 1,47), 3.312 MiB de VRAM, 176 s de pared con carga. Dos pasadas antes fallidas: una compartiendo GPU (parada a los 4 min) y otra al guardar (`torchcodec` ausente; se guarda con soundfile). Muestra enviada a las 13:49; tu juicio, pendiente. |

**Tu juicio, registrado tal cual.** 13:12 y 13:15: Piper y Kokoro no te gustan, y lo importante: "es
demasiado máquina, no sabe explicar, está leyendo muy literal" sobre el docstring leído tal cual; con
un guion oral escrito por Claude, "un poco mejor". 13:45: "la de Qwen es horrible", y la idea que
cambia el encargo: **olvidar el TTS; Claude escribe el guion y narras tú**, que queda más natural.
Chatterbox pendiente de oír. Eso separa dos problemas que hay que medir por separado: la voz y el
texto. Ninguna voz, por buena que sea, arregla un docstring leído, y tu voz resuelve las dos cosas a
la vez: la naturalidad y la licencia (nada sale de la máquina). La vía de voz humana está en 3.6 y
es la recomendada para ti.

## 1. Qué existe ya que sirve, con ruta

### 1.1 En CDA (planificado, no implementado)

- **CDA no existe en código.** `grep -rn "code_block\|code_search\|code_get\|code_annotation" naeth/ | grep -v node_modules | grep -v dist/` devuelve cero. No hay migración `007-code.sql` (`ls naeth/db/migrations/` → 002 a 006). Verificado en el plan hasta la sub-fase 2 (`docs/plan/biblioteca-codigo-fase2-2026-09-10.md:440`, `:461`, `:484`); no hay "Verificado en la sub-fase 3" ni superior (`grep -n "Verificado en la sub-fase"`).
- **Lo que el modelo del plan sí da a un vídeo**, columna por columna (`docs/plan/biblioteca-codigo-fase2-2026-09-10.md:55-77`): `symbol` (`:62`), `kind` (`:63`), `signature` (`:65`), `lineno`/`endlineno` (`:66`), `doc` tal cual (`:67`), `doc_lang` y `doc_translated` (`:68-69`), `source` entero (`:70`), `commit` y `file_sha256` (`:71-72`), `content_hash` (`:73`), `is_current` (`:77`). La versión la da `(repo, symbol, extracted_at)` sin tabla de supersesión (`:80-81`).
- **Las anotaciones** (`:85-93`): `block_id`, `memory_id` nullable a `memory(id)` (`:89`), `kind` en `important | summary | note | link` (`:90`), `text` (`:91`), `author` (`:92`). Son las aristas prosa-código del grafo (`:95`).
- **Lo que las tools devolverán** (`:263-279`): `code_search` da símbolo, fichero, líneas, primera frase de `doc`, `doc_lang` y si está al día (`:272-274`); `code_get` trae doc, fuente y anotaciones (`:281`).
- **La materia prima del guion ya tiene forma.** Las siete piezas de `Notes:` (`docs/guia-documentacion.md:42-48`): porqué, alternativa descartada, incidente con fecha, número medido, lo que NO hace, aviso `⚠`, referencia cruzada. Es literalmente la escaleta de un vídeo. Y cuando un porqué no está registrado, la guía obliga a decirlo (`:49-50`), que es lo que el guion tiene que heredar.
- **griffe ya da lo estructural** sin importar el código: `kind`, `lineno`, `endlineno`, `docstring`, `parameters`, `returns`, `decorators` y `git_info` con `commit_hash` (`docs/discovery/biblioteca-codigo-2026-09-10.md:134-137`). Hoy hay 131 símbolos Python con Doc y más de cinco líneas (`:229`, `:387`).

### 1.2 En el código vivo de Naeth

- `relation` une memoria con memoria y nada más: `source_id` y `target_id` son FK a `memory(id)` (`naeth/db/schema.sql:82-83`). El plan lo asume (`plan:46-49`).
- `relation_list` existe como tool (`naeth/app/mcp_server.py:540-546`) y como ruta `GET /api/memory/{id}/relations` (`:742-745`); `memory_get` no devuelve relaciones (su `return`, `:468-473`).
- El visor abre una nota por `#/m/<id>` y el grafo enfocado por `#/grafo/<id>` (`naeth/web/src/lib/router.svelte.ts:11`, `:15`, `:30`). No hay nada de `cda` ni `code` en `naeth/web/src` (`grep -rn -i -w "cda\|codedoc"` → cero) ni ruta `/api/code/*` en `naeth/web/src/lib/api.ts:10-80`. La vista `#/cda` es la sub-fase 7 (`plan:290`).
- Puertos: visor y API en `127.0.0.1:8800` (`naeth/docker-compose.yml:120`), loopback con `/mcp` en `8801` (`:208`). Dev server en `naeth/web/README.md:13`.
- El mapa maestro no sabe de CDA ni de vídeos (`grep -n -i "cda\|codedoc\|vídeo\|formaci\|alumn" docs/plan/mapa.md` → nada; última revisión 09/09, `docs/plan/mapa.md:3`).

### 1.3 En la discovery previa de diseño (24/08/2026)

`docs/discovery/stack-diseno-animacion.md` ya tenía la respuesta a "si Hyperframes sirve de renderizador":
sí, convierte HTML/CSS animado en MP4 determinista con Node 22, ffmpeg y Chrome headless (`:221-223`),
y se decidió que entraba "en su propio carril" para vídeo de producto (`:462-465`), sin instalarlo
(`:475`). Pencil no tiene línea de tiempo ni exporta vídeo (`:83`), y Anime.js anima en pantalla,
no a fichero (`:241-243`). Todo lo de Hyperframes salía entonces de la API de GitHub y el README, sin
ejecutarlo (`:532-533`). Hoy queda ejecutado: ver 3.2.

### 1.4 En la máquina

| Qué | Dónde y versión | Comprobado con |
|---|---|---|
| ffmpeg y ffprobe 9.0 full (libx264, libx265, `h264_nvenc`, aac, VP9, AV1) | `C:\Users\eneki\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe` | `ffmpeg -version`, `ffmpeg -hide_banner -encoders` |
| Node 24.19.0 y npm 11.17.0 | `F:\local\fnm\aliases\default` | `node --version`; el global está vacío (`npm ls -g --depth=0` → solo corepack y npm) |
| uv 0.12.2 con Python 3.11, 3.12, 3.13 y 3.14 | `uv python list --only-installed` | |
| faster-whisper 1.2.1 sobre CTranslate2, con large-v3, medium y tiny en caché; `--palabras` da `.words.json` | `F:\src\Whisper\.venv`, `F:\src\Whisper\README.md:44-49` | `pip list` del venv. Sin torch: no sirve de base para TTS |
| Playwright con Chromium 149 y 151 y sus headless shells, más su ffmpeg | `%LOCALAPPDATA%\ms-playwright` | `Get-ChildItem` |
| Brave 153 | `C:\Program Files\BraveSoftware\...\brave.exe` | Chrome y Edge no están en sus rutas habituales |
| Claude Code 2.1.266 con `-p`, `--output-format json`, `--json-schema`, `--allowedTools`, `--mcp-config`, `--strict-mcp-config` | `claude --version`, `claude --help` | MCP configurados: `naeth` y `pencil` (solo nombres) |
| OBS 32.2.2, Pen 1.2.8, Handy 0.9.6, yt-dlp | rutas en el inventario | |
| Docker 29.7.2 con la pila de Naeth sana | `docker ps` | api, viewer y worker `healthy` |

**Lo que NO hay, y el comando que lo dice:** espeak-ng (`where.exe espeak-ng` → nada; irrelevante:
Kokoro lo trae en `espeakng-loader` y Piper lo embebe, comprobado sintetizando), ninguna voz de
Windows en castellano (SAPI solo tiene Zira en-US), ningún TTS instalado, ningún framework de
animación (`npm ls -g`), ningún modelo de lenguaje local (`where.exe ollama`, `lms`, `llama-server`
→ nada; la caché de Hugging Face son 5 GB de ASR: `models--Systran--faster-whisper-*` y el Nemotron
de Handy), ImageMagick, SoX, ni Chrome de Google. El Agent SDK no está en ningún entorno (`pip show
claude-agent-sdk`, `npm ls -g @anthropic-ai/claude-agent-sdk` → vacío).

Lo instalado hoy en el scratchpad y que se borra con la sesión: cuatro venvs (Kokoro con torch
2.11+cu128, Piper, Chatterbox, Qwen3-TTS), Remotion, Playwright 1.63, Hyperframes, y 7,3 GB de
modelos en `~/.cache/huggingface/hub` (Qwen 4,3 GB, Chatterbox 3,0 GB, Kokoro 0,3 GB). Esos sí
quedan en disco.

## 2. Qué le falta a CDA para alimentar un vídeo

Contrastado bloque a bloque contra el plan. Cada falta lleva nombre y sitio en el plan.

1. **Relaciones bloque a bloque: no existen y son la mitad del encargo.** Un vídeo de "cómo encajan
   X, Y y Z" necesita saber que `memory_search` llama a `core.search`, a `_embed_query` y a `_hit`.
   El plan las deja fuera de fase a propósito: "las de código-código (imports, llamadas) no entran en
   esta fase" (`plan:95-97`), y `relation` no puede alojarlas (`schema.sql:82-83`). Lo medido hoy dice
   que el coste de extraerlas es pequeño: `ast` resuelve 106 aristas en 0,03 s sobre `naeth/app`, y
   para el bloque de prueba da exactamente `core.search` (`core.py:374-427`), `_embed_query`
   (`mcp_server.py:142-155`) y `_hit` (`:369-381`). **Cambio de plan con nombre: sub-fase 4 crea tres
   tablas, no dos**, añadiendo `code_edge (src_block, dst_block, kind: calls | imports, extracted_at)`,
   porque una tabla nueva hay que clasificarla en `MERGE_TABLES` antes de que exista
   (`F:\src\CENIT\core\reconciler\src\cenit_core\sync.py:81-87`; el sync aborta con tabla desconocida,
   `:143-146` y `:149-153`) y crearla después es una migración más en dos nodos. La extracción de
   aristas entra en la sub-fase 5 junto al extractor. Esto sirve al grafo con o sin vídeos: hoy el
   grafo tampoco podría pintar "esta función llama a esta otra".
2. **`code_get` tiene que devolver las aristas y el `source` con numeración absoluta.** El plan dice
   "doc, fuente y anotaciones" (`plan:281`). Para el vídeo hacen falta además `lineno` (para que el
   guion diga "línea 425" y el render resalte la 425), las aristas de `code_edge` en las dos
   direcciones, y `content_hash`, para que el vídeo quede atado a una versión del bloque. Es un cambio
   de la sub-fase 6, sin esquema.
3. **`Notes:` parseado, no como texto plano.** El guionista rinde más con las siete piezas separadas
   (porqué, medido, aviso...) que con el docstring en bruto. griffe lo parsea ya
   (`griffe.Docstring(..., parser="google").parse()`, probado en la sub-fase 0). Propuesta: `code_get`
   devuelve `doc_sections` calculado al vuelo; ninguna columna nueva.
4. **Dónde vive el guion.** Escribirlo cuesta 90 s y 0,36 USD nominales; re-renderizar cuesta un
   minuto y cero. Si el guion se guarda, el vídeo se regenera con otra voz o resolución sin volver a
   pagar el guion, y el guion es además la "explicación hablada" del bloque, consultable. Propuesta:
   un `kind` nuevo de `code_annotation`, `script`, con el JSON del guion en `text` y `author` como
   agente. El vocabulario de `kind` está en `plan:90` y es el sitio donde cambiarlo antes de la sub-fase 4.
5. **Dónde vive el vídeo: fuera de Naeth.** Un MP4 de 10 MB no entra en una base ADD-only que viaja en
   el sync. Propuesta: fichero en disco (`F:\src\Naeth\videos\<repo>\<symbol>\<content_hash>.mp4` o
   donde tú digas) y una anotación `kind = link` con la ruta. Decisión tuya (sección 6).
6. **Un mapa de pronunciación.** Medido con Piper: `core.search` suena "kore punto seartch" y
   `digest` "dixest" (fonemas `kˈoɾe pˈunto seˈaɾtʃ` y `ðixˈest` en la salida del fonemizador). El
   guion tiene que decir "la función search del núcleo" y no el identificador. Es una regla del
   prompt del guionista, no del modelo de datos; hoy lo hizo bien `claude -p` con esa instrucción.
7. **La vista `#/cda` no existe** (sub-fase 7, `plan:290`), así que la familia c (grabar el visor)
   no puede empezar hasta entonces. Las familias a y b no dependen de ninguna sub-fase: hoy se han
   hecho leyendo el fichero con `ast` y griffe.
8. **Bloques de otros repos.** Un vídeo del código de un cliente en JavaScript necesita el extractor
   de JS (sub-fase 9, `plan:342`) y el trato de GridWatch (sub-fase 10, `plan:359`). Para ti y para
   alumnos, con Python basta hoy.
9. **Traducción.** Si el bloque tiene `doc_lang = en` (GridWatch), el guion en castellano lo escribe
   Claude directamente desde la doc en inglés: no hace falta esperar la decisión de traducción de la
   sub-fase 5.

## 3. Las vías, de guion a MP4

Convenciones de las estimaciones. "Horas" son horas de sesión de trabajo contigo, midiendo con lo de
hoy como base: el vídeo entero de la vía b se montó en 1 h 45 min de sesión, instalaciones incluidas,
sin haberlo hecho antes. "Coste por vídeo" es para un vídeo de 2 a 3 minutos sobre un bloque, y
separa guion, voz y render. El guion con `claude -p` sin `--bare` consume de tu plan Max, no de una
API key (doc de costes de Claude Code, `code.claude.com/docs/en/costs`, comprobada el 14/09/2026:
"Claude Max and Pro subscribers have usage included in their subscription"); el 0,36 USD que reporta
es estimación de cliente. Con `--bare` o en un servidor va contra API key: con Sonnet 5 a 2/10 USD por
millón, una llamada de 3.000 tokens de entrada y 800 de salida son 0,014 USD; con Haiku 4.5, 0,007
(`platform.claude.com/docs/en/about-claude/pricing`, 14/09/2026).

### 3.1 Vía a · Diapositivas narradas

**Pila.** Marp CLI 4.5.1 (MIT, 06/09/2026, `marp-team/marp-cli`) para pasar Markdown a PNG numerados
(`--images png --image-scale 1.5`), con el Edge o Brave del sistema; voz local o de nube; `ffmpeg -f
concat` con una `duration` por diapositiva igual a la de su frase, `-pix_fmt yuv420p`. Resaltado de
líneas `{1,3-5}` con Shiki solo en `marp-core@next` (5.0.2, 04/09/2026); el `latest` 4.4.0 usa
highlight.js sin resaltado de líneas. Alternativa Slidev 52.19.1 (MIT) con `{2-3|5|all}` y magic
move, pero la interpolación del magic move no sobrevive al PNG: `--with-clicks` exporta un fotograma
por paso.

**Qué produce.** MP4 1080p con una diapositiva por frase: título, código con líneas resaltadas o un
diagrama. Sin animación. Mapeo frase a diapositiva 1:1, determinista por construcción.

**Horas.** Primer vídeo: 3 a 4 h (no está montado; la base es que hoy el concat y el guion ya están
probados y falta solo Marp). Sistema completo (comando `cda-video <symbol>` que lee el bloque por
`code_get`, escribe guion, sintetiza, exporta y concatena): 10 a 14 h.

**Coste por vídeo.** Guion 0 (Max) o 0,01 USD; voz 0 en local, 0,04 USD con Azure neural es-ES a 15
USD por millón de caracteres (y 500.000 gratis al mes); render, segundos de CPU.

**Audiencias.** Sirve para ti (repaso) y de sobra para preparar entrevistas. Para alumnos es corto:
un vídeo de diapositivas de código es lo que ya hace un PDF. Para un cliente no: acabado de charla, no
de producto. Es local de punta a punta si la voz es local.

**El riesgo que la tumba.** Que el resaltado por diapositiva no baste para explicar código: cada
cambio de foco es una diapositiva más, y un bloque de 60 líneas con 16 frases son 16 capturas casi
iguales. Se sabe en el primer vídeo.

### 3.2 Vía b · Animación programática de código con resaltado sincronizado

Es la que se ha construido hoy entera. Dos pilas dentro de la familia.

**Pila b1, Remotion.** Remotion 4.0.524 (12/09/2026, `remotion-dev/remotion`, 59.170 estrellas,
último push hoy). Licencia propia: gratis para "an individual" y empresas de hasta 3 empleados, con
uso comercial permitido; a partir de 4 personas, 25 USD por asiento y mes o 0,01 USD por render con
mínimo de 100 USD al mes (`remotion.pro/license`, 14/09/2026). Trae Chrome headless shell y ffmpeg
propios. Código: template oficial `remotion-dev/template-code-hike` (último commit 05/09/2026) con
Code Hike 1.1.0 (MIT): transiciones de código token a token calculadas por frame con
`useCurrentFrame`, que es lo que ninguna otra pila hace (las demás animan por CSS en tiempo real o
graban en tiempo real). No existe `@remotion/shiki` (comprobado en npm). Audio con `<Audio>` y
`calculateMetadata` para fijar la duración desde el JSON. ⚠ Trampa documentada de Windows: los props
van en fichero (`--props=./timeline.json`), nunca inline. Medido hoy: 65 s en 50 s, 140 s en 131 s a
1080p30, CPU.

**Pila b2, Hyperframes.** 0.8.38 (14/09/2026, `heygen-com/hyperframes`, Apache-2.0 sin umbrales,
49.836 estrellas, creado el 10/03/2026). La composición es HTML con `data-start` y `data-duration`
por elemento y una línea de tiempo GSAP (`demo/index.html` generado por `hyperframes init`), que
sale de un JSON de tiempos por plantilla, sin programa. Render determinista frame a frame, captura
por GPU, ffmpeg del sistema, Chrome propio (`npx hyperframes browser ensure`, 6 s hoy). Sin soporte
de código: se inyecta el HTML de Shiki. Medido hoy: 10 s en 14,5 s. Tres avisos: el proyecto tiene
seis meses; la plantilla carga GSAP desde `cdn.jsdelivr.net` en el render (para material de cliente,
localizar la dependencia); y manda telemetría anónima, que se apaga con `HYPERFRAMES_NO_TELEMETRY`
(variable presente en `node_modules/hyperframes/dist/cli.js`). Su `doctor` ya contempla Kokoro
(`kokoro-onnx`) y whisper.cpp como piezas locales opcionales: está pensado como pipeline de
narración, no solo como renderizador.

**Descartadas dentro de la familia, con el dato.** Motion Canvas 3.17.2 (MIT): el mejor nodo de
código (Lezer, patience diff, `selection` por líneas y palabras), pero sin render headless (issue
#415 abierta desde 25/02/2023) y sin commit de código desde el 16/02/2025. Revideo 0.11.0 (MIT,
10/07/2026): hereda ese nodo y sí renderiza headless, pero el equipo se fue a Midrender y "recent
changes have not yet been upstreamed" (`midrender.com/revideo`, 14/09/2026). Manim CE 0.21.0 (MIT,
10/08/2026): el único sin navegador ni Node, con `Code` sobre Pygments, pero sin transición de código
(PR #4114 abierto desde el 18/01/2025) y sin resaltado de líneas nativo.

**Qué produce.** MP4 1080p30 con el código en pantalla, líneas resaltadas y desplazadas según la
frase, subtítulo, y planos de título. Con Code Hike, transiciones entre bloques (X → Y → Z) por token.

**Horas.** Primer vídeo: hecho hoy en 1 h 45 min con un componente propio de 60 líneas. Con el
template Code Hike y transiciones entre tres bloques: 4 a 6 h más. Sistema completo (comando,
plantilla con títulos y transiciones, lectura por `code_get`, guardado del guion, tests): 25 a 40 h.
Con Hyperframes en vez de Remotion, sumar 3 a 5 h de aprender su modelo y restar la dependencia de
React.

**Coste por vídeo.** Guion 0 o 0,01 USD; voz igual que la vía a; render 1 min de CPU por cada minuto
de vídeo (medido: 0,77 a 0,94 de tiempo real).

**Audiencias.** Las tres. Para un cliente, elegir la pila por licencia: Remotion es gratis para ti
como autónomo, pero si el pipeline acaba corriendo dentro de una empresa de 4 o más personas, esa
empresa necesita licencia Automators; Hyperframes no tiene umbral.

**El riesgo que la tumba.** El mapeo frase a líneas lo decide el guionista, y hoy es correcto en 16 de
16 frases con Sonnet sobre un bloque con `Notes:` rico. Sobre un bloque sin `Notes:` el guion se
inventa el porqué o se queda en "esta función hace X". La calidad del vídeo es la de la
documentación, ni más ni menos, y eso es CDA. El segundo riesgo es la voz, que hoy no pasa tu oído.

### 3.3 Vía c · Grabación automatizada del visor sobre `#/cda`

**Pila.** Playwright 1.63.0 (Apache-2.0, 04/09/2026) con `recordVideo` sobre el visor en `8801`, o
Puppeteer 25.11.0 (Apache-2.0, 14/09/2026) con `page.record()`, nuevo desde el 03/09/2026: MP4 directo
por `Page.startScreenRecording` y audio opcional, marcado experimental. Narración mezclada después con
ffmpeg. Medido hoy con Playwright: 11,5 s de `#/grafo` en 13 s, 25 fps fijos en el código de
Playwright (`videoRecorder.ts`: `const fps = 25`, `-an`), WebM VP8, a MP4 con NVENC en 1 s. La descarga
del Chromium 153 que pide Playwright 1.63 expiró por red (dos intentos); funcionó con el headless
shell 151 ya en caché de otra sesión, y el Chromium completo 151 dio `spawn UNKNOWN`.

**Qué produce.** Un screencast real del visor: el bloque abierto, el grafo con sus vecinos, el
recorrido por las anotaciones. Lo que un espectador vería si usara Naeth.

**Horas.** Bloqueada por la sub-fase 7: `#/cda` no existe. Después: primer vídeo 4 a 6 h (guion,
coreografía de clics y scroll con `page.clock` para hacerlo determinista, mezcla); sistema completo
15 a 20 h.

**Coste por vídeo.** Voz igual; grabación en tiempo real, un minuto por minuto; sin CPU de render.

**Audiencias.** Para enseñar Naeth (producto) es la única que muestra el producto. Para explicar un
bloque de código es la peor: graba en tiempo real, sin audio, la sincronía se consigue a posteriori
y el aspecto es el del visor, no el de un vídeo didáctico. Para un cliente que quiera ver "su" código
en Naeth, sirve; para explicárselo, no.

**El riesgo que la tumba.** Que el visor no sea una interfaz de explicación. Hoy no lo es: pinta
notas y grafo. Habría que diseñar `#/cda` con el vídeo en mente (modo presentación, resaltado por
línea), y eso es diseñar dos cosas a la vez.

### 3.4 Vía d · Vídeo por API en la nube

Añadida porque encaja y hay que marcarla: **no vale para el cliente**, porque el código viaja en el
JSON de render. JSON2Video (elemento `html` con CSS3 y Tailwind, `voice` con Azure y `subtitles`
integrados; Hobby 16,95 USD al mes anual, `json2video.com/pricing`, 14/09/2026) es el único de los
tres servicios mirados con vía razonable para código; Shotstack (0,30 USD por minuto) solo por asset
HTML5 con restricciones duras (nada de `setTimeout` ni `requestAnimationFrame`, todo inline);
Creatomate no acepta HTML. Gamma, que ya tienes como MCP, exporta PDF, PNG y PPTX y **no vídeo**
(`developers.gamma.app`, endpoint `/gammas/{id}/export`, `exportAs: pdf | png | pptx`).

**Horas.** Primer vídeo 3 a 4 h; sistema 8 a 12 h. **Coste por vídeo.** 0,3 a 1 USD según servicio y
duración. **Audiencias.** Tú y alumnos. **Riesgo.** Dependencia de un tercero para el render y para la
voz, y cero control del resaltado por token.

### 3.5 La voz, transversal a las cuatro vías

Lo que decide es la licencia de los pesos y las marcas de tiempo, no la calidad. Comprobado en fuente
primaria el 14/09/2026 (repos, `LICENSE`, model cards de Hugging Face, PyPI).

| Motor | Versión y fecha | Licencia (código / pesos) | Castellano | Marcas de tiempo | Estado | Medido hoy |
|---|---|---|---|---|---|---|
| Piper (`OHF-Voice/piper1-gpl`) | 1.8.0, 04/09/2026 | GPL-3.0 / voz `davefx` CC0, `sharvard` CC BY 3.0 | es_ES, 2 voces medium | Por fonema, experimental, según voz (`davefx`: no) | Muy vivo; el repo viejo `rhasspy/piper` está archivado | Sí, arriba. Tú: no te gusta |
| Kokoro (`hexgrad/kokoro`) | 0.9.4, 05/04/2025 | Apache-2.0 / Apache-2.0 | `e`, voces `ef_dora`, `em_alex`; sin nota de calidad en `VOICES.md` | Solo en inglés (`join_timestamps` solo en la rama `'ab'` de `pipeline.py`) | Parado desde 06/08/2025 | Sí, arriba. Tú: no |
| Chatterbox Multilingual (`resemble-ai/chatterbox`) | 0.1.7, 26/03/2026 | MIT / MIT, con modelo `Chatterbox-Multilingual-es-es` dedicado a castellano peninsular (22/04/2026) | Sí | No | Vivo, empresa activa | RTF 1,47 en limpio, 3.312 MiB; marca de agua Perth siempre activa; tu oído, pendiente al cierre |
| Qwen3-TTS (`QwenLM/Qwen3-TTS`) | 22/01/2026, `qwen-tts` 0.1.1 | Apache-2.0 / Apache-2.0 | Sí, explícito | No | Vivo, 3,7 M descargas al mes | RTF 3,35 en limpio, 4.372 MiB. Tú: "horrible". Descartada |
| XTTS v2 (fork `idiap/coqui-ai-TTS`) | 0.27.5, 26/01/2026 | MPL-2.0 / **CPML, no comercial incluido el output** | Sí | No | Coqui cerró en 2024; fork en mantenimiento | Descartado por licencia |
| F5-TTS | 1.1.22, 23/07/2026 | MIT / **CC-BY-NC-4.0**; sin checkpoint oficial en español | Solo fine-tunes de comunidad con licencia contradictoria | No | Vivo | Descartado |
| Fish/OpenAudio S2 | 2.0.0-beta, 10/03/2026 | Fish Audio Research License, **sin derechos comerciales** | Sí, "tier 2" | No | Vivo | Descartado |
| Orpheus | sin releases; último commit 05/12/2025 | Apache-2.0 / Apache-2.0 | Modelo es+it de investigación, 100 descargas al mes | No | Parado | No probado |
| MeloTTS | 0.1.2, 01/03/2024 | MIT / MIT | Sí | No | Abandonado (último commit 24/12/2024) | No probado |
| Azure AI Speech | voces es-ES de la doc del 17/07/2026 | Comercial sin registro; obliga a declarar que la voz es sintética | 16 voces neurales es-ES, 2 HD, MAI-Voice-2 en preview | **Sí**: `WordBoundary` en el SDK, `wordBoundaryEnabled` en batch, `<bookmark>` | Nube | 15 USD por millón de caracteres, 500.000 gratis al mes (F0); HD 22 USD |
| ElevenLabs | `eleven_v3`, `eleven_multilingual_v2` | Comercial desde cualquier plan de pago; el Free no | es-ES nombrado | **Sí, carácter a carácter** (`with-timestamps`) | Nube | 100 USD por millón por API con v3, 50 con Flash; Creator 22 USD al mes |
| Google Cloud TTS | Chirp 3 HD, Gemini 2.5 Flash TTS | Comercial, sin atribución; ⚠ restricción de menores de 18 en la sección 20 de los términos | 30 voces Chirp 3 HD es-ES | Solo `<mark>` en `v1beta1` con Standard, WaveNet y Neural2; **no** con Chirp 3 HD ni Gemini | Nube | Gemini 2.5 Flash a 0,25 USD por hora de audio; Neural2 16 USD por millón |
| OpenAI `gpt-4o-mini-tts` | snapshot 15/12/2025 | Comercial; obliga a declarar voz IA | Voces "optimized for English", sin variante es-ES | **No**, en ningún parámetro | Nube | 0,60 USD por millón de tokens de texto más 12 por millón de audio |
| Cartesia Sonic | 3.6 | Comercial desde Pro | Acento `castilian` como parámetro | Palabra y fonema por SSE o WebSocket | Nube | Pro 5 USD al mes |

**Marcas de tiempo cuando el motor no las da.** El guion lo conoces exacto, así que es alineación
forzada, no transcripción. MMS_FA de torchaudio (medido hoy: 151 palabras en 0,94 s) y el modelo por
defecto de `ctc-forced-aligner` son CC-BY-NC; el modelo español por defecto de WhisperX
(`VOXPOPULI_ASR_BASE_10K_ES`) también, aunque WhisperX 3.8.6 (BSD-2) acepta `--align_model
jonatasgrosman/wav2vec2-large-xlsr-53-spanish`, que es Apache-2.0. Montreal Forced Aligner 3.4.2
(MIT, 20/08/2026) tiene modelo español CC BY 4.0, comercial con atribución, pero se instala por conda.
Y torchaudio está en "maintenance phase" (README de `pytorch/audio`). Para ti: MMS_FA, ya probado.
Para vender: WhisperX con el modelo Apache o MFA.

### 3.6 Vía e · Voz humana: Claude escribe el guion, narras tú

Tu idea de las 13:45, y encaja mejor que cualquier TTS con lo que hay medido.

**Pila.** El mismo guion JSON de `claude -p` (frases con líneas), impreso como teleprónter; grabas
con OBS 32.2.2 (ya instalado) o con el micro que uses para Handy; alineación forzada local de tu
audio contra el guion, que conoces exacto: `faster-whisper --palabras` en `F:\src\Whisper` (ya
montado, `.words.json`, unas 2x tiempo real en la 3070, `README.md:44-49`) o MMS_FA (medido hoy:
151 palabras en 0,94 s); de ahí la línea de tiempo por frase y palabra; y Remotion como en la vía b.
Hyperframes tiene este flujo de serie: `hyperframes init --audio narracion.wav --language es`
transcribe con whisper.cpp y monta la composición sobre el audio (`hyperframes init --help`, 14/09).

**Qué produce.** El mismo MP4 de la vía b con tu voz. Sin marca de agua, sin licencia de pesos, sin
que nada salga de la máquina, y sin que el vídeo suene a máquina.

**Horas.** Primer vídeo: 2 a 3 h (el render y el guion están; falta el paso de grabar y el de
alinear tu audio en vez del sintético, que es cambiar un fichero). Sistema completo: las mismas 10 a
14 h de un comando, más un modo "teleprónter" que te muestre frase y líneas mientras grabas. El
tiempo por vídeo pasa a incluir tu grabación: un guion de 16 frases son 3 minutos de lectura y una o
dos tomas.

**Coste por vídeo.** Guion 0 o 0,01 USD; voz, tu tiempo; render igual.

**Audiencias.** Para ti es la mejor: narrar el guion en voz alta es exactamente ensayar la respuesta
de entrevista, y el vídeo queda como registro. Para alumnos es la voz que esperan de un profesor.
Para un cliente es la única voz sin ninguna obligación legal (nada de "voz sintética", nada de
watermark). **Lo que pierde:** "bajo demanda" deja de significar "sin ti": un vídeo nuevo exige que
lo grabes; y para regenerar un vídeo cuando cambia el bloque hay que regrabar las frases que cambian.

**El riesgo que la tumba.** Que grabar te cueste más que leer, y no lo hagas. Se sabe en el primer
vídeo, y es la primera medida del prototipo (sección 5).

**Alineación sobre voz real, lo que no está medido.** Hoy solo se ha alineado audio sintético, que es
limpio. Con tu voz habrá titubeos, repeticiones y frases cambiadas sobre la marcha; la alineación
forzada tolera lo primero y se pierde con lo tercero. Regla práctica: el guion es el que se lee, y
si cambias una frase al grabar, se corrige el JSON antes de alinear. `⚠ sin verificar` con una
grabación real; entra en el prototipo.

**Guion sin nube, si un día hiciera falta.** No hay ningún modelo local hoy. Cabrían en la 3070 a Q4
Salamandra 7B Instruct 2606 (BSC, Apache-2.0, castellano sobremuestreado 2x, 4,85 GB el GGUF de
comunidad de la versión de 2025) o Qwen3.5-9B (Apache-2.0, 5,68 GB). No hace falta: el guion pasa por
Claude Code y eso está permitido para el cliente por tu propia regla.

## 4. Recomendación por audiencia

**Tú, repaso y entrevistas: vía b1 con Remotion, guion por `claude -p`, y tu voz (vía e).** Razón:
la vía b es la única probada de punta a punta hoy, el guion de Sonnet ya explica en vez de leer (16
frases con líneas correctas), el render cuesta un minuto por minuto en CPU, y tu voz resuelve lo que
ninguna sintética ha pasado: tu oído. Añade lo que ningún TTS da: narrarlo es ensayar la entrevista.
Si un día quieres vídeos sin grabar, la voz de respaldo es Azure neural es-ES dentro de los 500.000
caracteres gratis al mes (unas 9 horas a 150 palabras por minuto) con `WordBoundary` de regalo,
admisible para tu código porque no es de cliente. **Lo invalidaría** que grabar te cueste más que
leer y no lo hagas, o que tras el prototipo sigas prefiriendo leer el docstring: entonces el problema
es el formato vídeo, no la voz, y sobra el vídeo.

**Alumnos: la misma vía b1 con el template Code Hike y tu voz; nube solo si el volumen no lo
permite.** Razón: las transiciones token a token entre bloques son lo que diferencia un vídeo
didáctico de una captura, y solo Remotion las calcula por frame; y la voz del profesor es la que un
alumno espera. Si hay que producir más vídeos de los que puedes grabar, ElevenLabs por la alineación
por carácter y la calidad, si el volumen es bajo (Creator 22 USD al mes cubre 2 horas de audio por
API), o Azure HD (22 USD por millón) si sube. **Lo invalidaría** que la formación necesite interacción (ejecutar,
pausar, preguntar) y no vídeo; o que el listón visual pida diseño de pantalla que no sale de una
plantilla, y eso es trabajo de Pencil y de una persona, no de un pipeline.

**Cliente: vía b, con la pila elegida por licencia, todo local salvo el guion, y tu voz.** Remotion
si el pipeline corre en tu máquina como autónomo (gratis); Hyperframes (Apache-2.0) si el cliente lo
va a correr en su empresa de 4 o más personas, con la dependencia de GSAP localizada y
`HYPERFRAMES_NO_TELEMETRY`. Voz: la tuya, que es además la de quien le explica su sistema al cliente;
si hiciera falta sintética, Chatterbox (MIT, con marca de agua Perth, que ante un cliente juega a
favor) siempre que pase tu oído; Qwen queda fuera por tu juicio y por su RTF de 3,4. Marcas: WhisperX
con el modelo Apache o MFA, nunca MMS_FA. Guion por Claude Code, permitido por tu regla. **Lo invalidaría** que el
cliente exija que el guion tampoco salga (entonces Salamandra 7B en local, 4,85 GB, sin probar), o que
su código sea JavaScript antes de que exista el extractor de la sub-fase 9.

**Empates.** Entre Remotion e Hyperframes para ti no hay empate: Remotion tiene el soporte de código
(Code Hike) y seis años de historia; Hyperframes tiene seis meses. Para el cliente sí empatan, y lo
desempata la licencia según quién ejecute. Entre Azure y ElevenLabs para alumnos empatan en
timestamps; los desempata el presupuesto (7 veces de diferencia) y tu oído.

**Sobre el orden respecto a CDA.** Ninguna vía a o b necesita una sub-fase de CDA para el prototipo:
hoy se ha hecho con `ast` y el fichero. Lo que sí pide el vídeo es entrar al plan **antes de la
sub-fase 4**: `code_edge` y el `kind = script` se deciden ahí porque el esquema es ADD-only y el sync
exige clasificar las tablas antes de crearlas. El pipeline de vídeo como sistema va después de la
sub-fase 6, cuando `code_get` exista, y no antes: construirlo sobre `ast` y luego sobre `code_get` es
hacerlo dos veces.

## 5. Prototipo de una tarde: cuatro horas para saber si esto vale

Ya está hecho medio: el vídeo de `memory_search` de hoy. Lo que falta para decidir es lo que hoy no
se ha medido: si el vídeo te sirve más que leer, y si una voz pasa tu oído. Objetivo: un vídeo de
"cómo encajan" tres bloques reales de `naeth/app`, con transiciones, y tres medidas.

**Bloques.** `mcp_server.memory_search` (384-443), `core.search` (374-427, ejemplo canónico 5.4 de
la guía) y `mcp_server._embed_query` (142-155, la caída silenciosa a léxica). Las aristas entre ellos
las da el script de `ast` de hoy; el guion recibe los tres bloques y las aristas.

**Pasos, con tiempo.**

1. (30 min) Grabar tú el guion de hoy (16 frases, unos 3 minutos) con OBS o el micro de Handy,
   leyendo del JSON impreso, y alinearlo con `faster-whisper --palabras` o MMS_FA. Es la medida que
   falta: si grabar te cuesta más que leer, se para aquí y se ha gastado media hora. La voz sintética
   queda como respaldo, no como paso.
2. (45 min) Guion con `claude -p --json-schema` desde los tres bloques más aristas, con el contrato
   de hoy ampliado: cada frase lleva `block` además de `lines`, y un plano `transition` cuando cambia
   de bloque. Guardar el JSON: es el `kind = script` de la sección 2.
3. (30 min) Grabar el guion nuevo y alinearlo: línea de tiempo por frase y palabra desde la
   alineación forzada, con las frases que cambiaste al grabar corregidas en el JSON antes de alinear.
4. (90 min) Remotion con `template-code-hike`: tres bloques como estados de Code Hike, transición
   token a token en los planos `transition`, resaltado de líneas y subtítulo como hoy. Render.
5. (45 min) Medir.

**Qué medir, y el criterio.**

| Medida | Cómo | Criterio para seguir |
|---|---|---|
| Sirve más que leer | Ves el vídeo sin abrir el código y respondes tres preguntas de entrevista sobre esos bloques (por qué digest y no texto; qué pasa si el modelo cae; por qué 50 por rama). Luego lo mismo leyendo la doc. | Aciertas al menos 2 de 3 con el vídeo, y no te cuesta más que leer |
| Grabar frente a leer | Minutos de grabación (tomas incluidas) frente a minutos que tardas en leer el bloque y su doc | Grabar no cuesta más del doble que leer; si cuesta más, el vídeo bajo demanda no lo harás |
| Alineación de voz real | Palabras del guion que la alineación coloca mal o no encuentra, sobre tu grabación | Menos del 5 %; si titubeos o cambios de frase la rompen, hace falta el paso de corregir el JSON antes de alinear |
| Sincronía | Diferencia entre el inicio de cada frase en el audio y el frame en que cambia el resaltado, sobre 5 frases al azar (fotograma con `ffmpeg -ss`) | Menos de 200 ms de media |
| Coste y tiempo | Pared total del paso 2 al 4, coste nominal del guion, minutos de render | Menos de 15 min de pared por vídeo de 3 min, sin contar el render, para que "bajo demanda" sea cierto |
| Errores de guion | Frases que afirman algo que el código no dice, contadas por ti | 0 sobre bloques con `Notes:`; anotar cuántas sobre un bloque sin `Notes:` si da tiempo |

Si pasa todas, la vía b con tu voz entra al plan de CDA como sub-fase propia después de la 6. Si
falla la primera, no hay proyecto de vídeo y CDA sigue igual. Si falla solo grabar, queda la voz de
respaldo (Azure para ti y alumnos, Chatterbox para cliente si pasa tu oído), y si tampoco, el
proyecto espera a una voz mejor, que llega cada pocos meses, y no cuesta nada esperar.

## 6. Decisiones que tienes que tomar tú antes de empezar

1. **Confirmar la voz humana como vía principal, y qué respaldo sintético queda.** Tu voz cuesta tu
   tiempo y resuelve oído y licencia. Local sintético cuesta 0 y no ha pasado tu oído (Piper, Kokoro,
   Qwen; Chatterbox pendiente). Nube pasa el oído, cuesta desde 0 (Azure F0) hasta 100 USD por millón
   de caracteres (ElevenLabs), y saca el guion de la máquina, que para tu código y el de formación
   está permitido. Para el cliente no hay decisión: tu voz o local.
2. **Si `code_edge` entra en la sub-fase 4.** Recomendación: sí, tres tablas de golpe, porque
   clasificar y migrar dos veces cuesta más que una columna de más, y el grafo la aprovecha con o sin
   vídeo.
3. **Si el guion se guarda en CDA como anotación `script`** o se regenera cada vez. Guardarlo hace el
   vídeo reproducible y el guion consultable por `memory_search`; no guardarlo deja `kind` como está.
4. **Dónde viven los MP4** (carpeta en `F:\src\Naeth`, gitignorada, o fuera del repo) y si se
   publican en algún sitio para alumnos.
5. **Remotion o Hyperframes para el cliente**, que depende de quién ejecuta el pipeline. Si nunca lo
   ejecuta el cliente, Remotion y punto.
6. **Aceptar las obligaciones de la nube** cuando se use: declarar voz sintética (Azure, OpenAI),
   atribución en el plan gratuito de ElevenLabs (no usarlo), y la restricción de menores de 18 de
   Google si hay alumnos menores.
7. **El orden.** El prototipo puede ser mañana con `ast`; el sistema espera a la sub-fase 6. Y la
   sub-fase 2b (identificadores en inglés), que hoy se ha movido para hacer esto, sigue pendiente.
8. **Cuánto invertir en alumnos antes de tener alumnos.** Las 25 a 40 h del sistema completo son
   para la audiencia 2; para ti bastan las 10 a 14 de un comando sin transiciones.

## 7. Decisiones tomadas el 14/09/2026, de 14:22 a 14:30

Tomadas por Eneko en dos rondas de AskUser tras leer el documento y oír las cuatro voces. Sustituyen
a la sección 6 en lo que la contradigan.

| Decisión | Qué se decidió | Consecuencia |
|---|---|---|
| Renderizador | **Remotion con Code Hike** | Pila b1. Hyperframes y Marp quedan como referencia. Licencia gratis mientras lo ejecute Eneko como autónomo. |
| Voz | **Sin voz por defecto; la de Eneko, opcional, encima.** Todas las sintéticas descartadas, Chatterbox incluida | El vídeo se explica solo: texto en pantalla, resaltado y transiciones. No hay TTS en el pipeline. Si narra, se alinea su grabación contra el guion en local. |
| Ritmo | **Tiempo de lectura por frase** (unos 2 s más 0,35 s por palabra, ajustable) | Determinista sin grabar. Si hay narración, manda el audio. |
| Música | **Biblioteca libre por pista** (Pixabay Music, YouTube Audio Library, Free Music Archive), licencia comprobada pista a pista | Coste 0. Las que pidan atribución la llevan en la descripción del vídeo. Nada generado. |
| Guion | **Se guarda en CDA como `code_annotation.kind = script`** | El vocabulario de `kind` (`plan:90`) gana un valor antes de la sub-fase 4. El guion es buscable y el vídeo se regenera gratis. |
| Aristas | **`code_edge` entra en la sub-fase 4: tres tablas de golpe** | Cambio del plan: `plan:95-97` deja de excluir las llamadas; la extracción con `ast` entra en la sub-fase 5; `code_get` las devuelve en la 6. Clasificar las tres en `MERGE_TABLES` a la vez. |
| Vídeos | **Fuera del repo**, en una carpeta aparte con `<repo>/<symbol>/<content_hash>.mp4` y una anotación `link` con la ruta | Fuera de la base y del sync. La ruta concreta queda por fijar. |
| Cuándo | **El prototipo, después de la sub-fase 6**, sobre `code_get` y `code_edge` de verdad | No se hace con `ast` fuera de CDA. El orden de CDA sigue: 2b, 3, 4 (con tres tablas y el `kind` nuevo), 5, 6, y entonces el prototipo de la sección 5, con texto en pantalla en vez de voz. |

Criterio de Eneko para todo ello, textual: "lo más importante es que el vídeo se sienta bien y coste
0 a poder ser". Lo que "se sienta bien" significa en pantalla (tema, tipografía, ritmo de las
transiciones, música) no está decidido y es trabajo de diseño del prototipo, con Pencil si hace
falta, no de esta investigación.

**Lo que esto cambia en el plan de fase 2, escrito allí el 14/09 a las 14:35** por orden de
Eneko: la sub-fase 4 crea `code_edge` (tabla nueva en el §1 del plan) y añade `script` al
vocabulario de `kind`; la sub-fase 5 extrae aristas de llamada; la sub-fase 6 las expone en
`code_get` junto con `lineno`, `content_hash` y `doc_sections`; y entra la sub-fase 6b, "Vídeos
desde CDA", con el prototipo de la sección 5 como entregable verificable.

## Fuentes primarias consultadas (14/09/2026)

Remotion: `registry.npmjs.org/remotion`, `remotion.dev/docs`, `remotion.pro/license`,
`github.com/remotion-dev/template-code-hike`. Hyperframes: `github.com/heygen-com/hyperframes`,
`registry.npmjs.org/hyperframes`, y su CLI ejecutada (`doctor`, `init`, `render`). Motion Canvas:
`github.com/motion-canvas/motion-canvas` (issue #415). Revideo: `midrender.com/revideo`,
`github.com/midrender/revideo`. Manim: `pypi.org/project/manim`, PR `ManimCommunity/manim#4114`.
Playwright: `playwright.dev/docs/videos`, `playwright-core/src/server/videoRecorder.ts`. Puppeteer:
changelog 25.10.0 y 25.11.0. Marp: `github.com/marp-team/marp-cli`, dist-tags de `@marp-team/marp-core`.
Slidev: `sli.dev/guide/exporting`. Gamma: `developers.gamma.app/docs`. ffmpeg: `doc/demuxers.texi`
(concat). Voz local: `github.com/hexgrad/kokoro` (`pipeline.py`), `github.com/OHF-Voice/piper1-gpl`
(`docs/ALIGNMENTS.md`, model cards de `rhasspy/piper-voices`), `github.com/resemble-ai/chatterbox` y
`huggingface.co/ResembleAI/Chatterbox-Multilingual-es-es`, `github.com/QwenLM/Qwen3-TTS` y
`huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base`, `huggingface.co/coqui/XTTS-v2/raw/main/LICENSE.txt`,
`github.com/SWivid/F5-TTS`, `github.com/fishaudio/fish-speech` (LICENSE), `github.com/canopyai/Orpheus-TTS`,
`github.com/myshell-ai/MeloTTS`. Alineación: `docs.pytorch.org/audio` (MMS_FA), `github.com/m-bain/whisperX`
(`alignment.py`), `github.com/MahmoudAshraf97/ctc-forced-aligner`, `pypi.org/project/Montreal-Forced-Aligner`,
`mfa-models.readthedocs.io`. Nube: `elevenlabs.io/pricing/api`, `elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps`,
`developers.openai.com/api/docs/pricing`, `learn.microsoft.com/azure/ai-services/speech-service/language-support`,
Azure Retail Prices API, `docs.cloud.google.com/text-to-speech`, `cloud.google.com/text-to-speech/pricing`,
`cartesia.ai`. Orquestador: `code.claude.com/docs/en/headless`, `code.claude.com/docs/en/cli-reference`,
`code.claude.com/docs/en/costs`, `code.claude.com/docs/en/agent-sdk/structured-outputs`,
`platform.claude.com/docs/en/about-claude/pricing`. Modelos locales: `huggingface.co/BSC-LT/salamandra-7b-instruct-2606`,
`huggingface.co/Qwen/Qwen3.5-9B`.

Lo que solo sostiene una opinión de practicante, marcado en el texto: ninguna cifra de este
documento; las que circulan (RTF de Kokoro, VRAM de XTTS, "17 KB" de Anime.js, el cierre de PlayHT) se
han dejado fuera o señaladas como tales en los informes de los agentes.
