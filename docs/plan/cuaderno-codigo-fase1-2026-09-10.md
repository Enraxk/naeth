# Cuaderno de código: investigación de fase 1

**Fecha**: jueves 10/09/2026.
**Origen**: Eneko detecta que ha dejado de revisar el código que escriben los agentes por él. Cita literal: "si no me gustan nada los vibe coders, ¿qué diferencia tengo yo ahora mismo de uno de ellos?". Quiere que cada vez que se escriba código se revise, se documente y quede como ejemplo consultable.
**Decisiones ya tomadas por él**: el cuaderno vive en **un apartado nuevo de Naeth**, y **se siembra con un barrido priorizado de Naeth, CENIT y Yogin, cortado por un tope de tiempo**.

> ⚠ **CORREGIDO a las 17:15 del 10/09.** La primera versión de este documento decía "arranca vacío, solo con lo que se trabaje de hoy en adelante, sin barrido retroactivo". Eneko lo corrigió al releer el informe de cierre: hay código vivo en los tres repos que quiere dentro. La guarda contra el proyecto de documentación de seis semanas **ya no es arrancar vacío, es el tope de tiempo**. Y como un barrido exhaustivo de tres repos son semanas y el tope no lo es, el barrido es **priorizado, no exhaustivo**: se corta cuando se acaba el presupuesto, así que **la fase 2 tiene que fijar el orden de prioridad antes de barrer, no después**.
>
> **Los cuatro criterios de qué merece ficha**, elegidos los cuatro: (1) lo que no sabrías reescribir hoy sin mirar, que por ser autoevaluable en diez segundos sirve además como orden de prioridad; (2) lo que costó descubrir, o sea el porqué y no el qué; (3) lo que vas a volver a necesitar, el recetario; (4) lo que se rompe si se toca mal, que entra como aviso y no como ejemplo. Y la fase 2 debe **buscar qué otros criterios existen**, en vez de dar estos cuatro por cerrados.
**Qué es este documento**: fase 1 de su metodología, investigación antes de tocar nada. No trae plan de implementación ni esquema. Trae terreno, tensiones y lo que ya estaba investigado.
**Cómo leer**: cada afirmación lleva fichero y línea, o el comando que la sostiene. Lo medido contra el nodo vivo el 10/09 va marcado. Lo no verificado va marcado.

---

## 0. El disparador: qué se midió antes de empezar

Dos mediciones sostienen todo lo demás.

**El simulacro de recuperación (10/09, mañana).** 28 preguntas sobre sus propios sistemas, contestadas de memoria y sin abrir el código. Resultado: 6 aciertos. El patrón importa más que el número: conservó método y principios (aislar un cambio cada vez, el dinero en céntimos enteros, empezar un incidente por preguntas) y perdió los mecanismos (cómo se llama la función, qué devuelve el filtro atómico, por qué un campo va al final del índice). Ocho de los fallos son sobre piezas que construyó y documentó él en las últimas seis semanas, incluido describir al revés la reserva atómica de Yogin, que es la mejor pieza de ingeniería de ese repo.

**La medición del historial de git (10/09, tarde).** Cinco repos, solo commits suyos, con exclusión de ficheros generados y binarios. **No confirma la hipótesis del deterioro:**

| Señal | 2025 | 2026 |
|---|---|---|
| Commits | 191, un repo | 966, cinco repos |
| Mediana de líneas por commit (GridWatch, única comparación limpia) | 117 | 40 |
| Mediana de caracteres del asunto | 97 | 67 |
| Commits con cuerpo explicativo | 28% | 88% a 97% en repos de producto |
| Densidad de comentarios, sin controles | 28,7% | 14,6% |
| Densidad de comentarios, con controles | **16,8%** | **15,9%** |
| Pull requests fusionados por él | 13 | **0** |
| Reverts | 0 | 0 |

La caída de comentarios se evapora al quitar dos sesgos: 16 de los 33 ficheros de 2025 son primitivas generadas por el CLI de shadcn con una cabecera de documentación añadida en una sola pasada el 06/06/2025, y 51 de los 141 ficheros de 2026 son tests, que comentan poco por naturaleza.

**Lo único que sobrevive es la desaparición del artefacto de revisión**: 13 pull requests propios fusionados en 2025, cero en 2026, todo commit directo a `main` en los cuatro repos. Con el matiz honesto de que nadie abre un pull request contra sí mismo en un repo personal, y de que leer un diff en el editor no deja rastro.

**Y el límite que cierra esta vía de medición**: git no distingue quién escribió cada línea, así que ninguna métrica del historial puede separar el código de Eneko del de un agente. Además no hay comparación temporal limpia: en GridWatch los 49 ficheros grandes creados en 2026 los creó Edward Keane, no él, así que 2025 es GridWatch y 2026 son otros repos. No hay un solo par de ficheros del mismo repo, mismo stack y mismo autor en las dos épocas. **Esta medición no se puede repetir mejor. No repetirla.**

Conclusión del bloque: el registro no dice que se haya convertido en un vibe coder. Dice que hace más, en trozos más pequeños y con más explicación escrita. La única medición que respondió de verdad fue el simulacro, y lo que dijo es que no ha perdido oficio, ha perdido la recuperación.

---

## 1. Naeth: qué necesitaría para sostener código sin mentir

### 1.1 Lo que ya funciona a favor

- **El contenido entra intacto.** `content text NOT NULL` sin tope (`naeth/db/schema.sql:27`), y `core.add` no valida ni transforma nada del contenido (`app/core.py:88-119`). Comprobado en negativo: `grep -rniE "strip\(\)|normaliz|textwrap|reflow|dedent|\.replace\(" naeth/app/*.py` solo acierta en el `strip()` del digest (`core.py:78`), el escape de LIKE de un `path_prefix` (`core.py:275`) y el recorte del excerpt de salida (`mcp_server.py:292-298`). Sobre `content` no hay ni uno.
- **El tamaño no es problema.** Distribución real medida el 10/09 sobre `memory_current`: mínimo 45 caracteres, mediana 2.360, p90 4.708, máximo 36.266. El máximo es un outlier de otra naturaleza, una transcripción cruda de Whisper, y el techo real de una nota de conocimiento ronda los 8.500 (`docs/plan/fase-4-0-tope-y-prioridad.md:32-35`). Un fragmento de 50 a 300 líneas con su explicación cae entre 2.000 y 12.000 caracteres, o sea dentro del rango que el corpus ya maneja.
- **La búsqueda léxica no lematiza.** El `tsvector` se genera con configuración `'simple'`, no `'spanish'` (`schema.sql:42-44`), y las tres ramas de consulta usan `plainto_tsquery('simple', ...)` (`core.py:326, 328, 341, 342, 348`). Sin stemmer y sin descarte de stopwords, en los dos lados. Medido el 10/09: buscar `SKIP LOCKED` sobre una nota que contiene `FOR UPDATE SKIP LOCKED` **sí la encuentra**, y buscar `$expr` sobre una nota con `$expr` **también**, porque el símbolo se cae simétricamente en la consulta y en el documento.
- **Un `memory_type` nuevo no cuesta migración.** `memory_type text NOT NULL DEFAULT 'observation'` sin CHECK (`schema.sql:37`), y `grep -rn "memory_type" naeth/db/` devuelve esa única línea, que además es un comentario desactualizado. Escribir `memory_type='code'` funciona hoy.
- **Los filtros se aplican dentro de cada rama, no sobre el resultado.** `_filtros` ofrece `path_prefix`, `tags`, `memory_type` y `since` (`core.py:278-302`), y el razonamiento de por qué van dentro está escrito (`core.py:311-314`). Un `path_prefix='code/'` deja limpia una búsqueda de código.

### 1.2 Las cinco tensiones, con veredicto

**a. Fidelidad literal: el backend la resuelve, el visor la rompe, el grafo la ignora.**

La grieta concreta está en `naeth/web/src/lib/wikilinks.ts:246-247`:

```ts
export const unescapeMarkdown = (src: string): string =>
  src ? src.replace(/\\([[\]_])/g, '$1') : src
```

Se invoca desde `components/Milkdown.svelte:153`, que su propio comentario describe como el único punto por el que sale texto del editor. **Esa expresión no tiene guarda de bloque de código.** Sus dos hermanas sí la tienen: `toDisplayMarkdown` envuelve en `outsideCode` (`wikilinks.ts:210`) y `extractLinkedIds` también (`:256`), donde `outsideCode` (`:197-201`) trocea por vallas y por backticks. Consecuencia: cualquier `\[`, `\]` o `\_` dentro de un bloque de código pierde la barra al guardar desde el visor. En una expresión regular, en una cadena escapada de Python o en LaTeX, eso es corrupción silenciosa.

Hay un segundo frente sin cerrar en la misma zona: D7, el editor nace marcado como modificado (`docs/plan/visor-v2-cierre.md:322-330`), con la hipótesis en pie de que Milkdown normaliza el markdown al cargar y sin diagnosticar qué normaliza. Si es cierto, cada guardado desde el visor reescribe el bloque según las reglas de serialización del editor.

Y el backend ignora el problema por su lado: `graph_links` corre el regex de wikilinks sobre el contenido entero, sin excluir vallas (`core.py:460-463`), igual que la higiene de wikilinks rotos (`core.py:561-570`). El front protege el código, el backend no. Un `if [[ -f fichero ]]` de bash o un indexado anidado `a[[0]]` se convierten en wikilink fantasma. Medido el 10/09: hoy 208 de 558 notas contienen `[[` y solo 3 lo combinan con una valla, así que no ha estallado; un cuaderno de código lo estrenaría el primer día con el primer script de shell.

⚠ Nada de esto se ha verificado sobre un bloque de código real. Es lectura de código más un frente documentado, no medición. Se comprueba en un minuto pegando una expresión regular con `\_` en una nota y guardándola desde el visor.

**b. Búsqueda: la rama léxica queda a medias y la semántica está rota, y no solo para código.**

Tokenización real, medida el 10/09 con el tokenizador del modelo y con `to_tsvector`:

| Caso | Resultado | Consecuencia |
|---|---|---|
| `c.execute(sql)` | un solo token `'c.execute'` | Buscar `execute` **no encuentra la nota**. Es el modo de fallo más probable, porque el nombre del método suelto es justo lo que uno recuerda |
| `memory_type` | dos tokens, `'memory' & 'type'` | Conserva el recall y **destruye la precisión**: casa con cualquier nota que mencione las dos palabras en párrafos distintos |
| `<=> ::= => {}` | tsquery **vacía**, con aviso de Postgres | La rama léxica desaparece y el RRF decide solo con la semántica, **sin que nada avise** |

Y el RRF pesa las dos ramas igual (`core.py:351`), sin palanca para subir la léxica en una consulta de token exacto, que es el modo natural de consultar código.

**El hallazgo grande está en la rama semántica, y es un defecto vivo hoy.** El modelo es `intfloat/multilingual-e5-large` con `model_max_length: 512`, y fastembed **trunca en silencio**. Verificado el 10/09 en vez de supuesto: dos textos idénticos en sus primeras 120 líneas y distintos solo en la cola devuelven **el mismo vector, bit a bit**, coseno 1,0.

Cuánto cabe en 512 tokens, con el tokenizador real:

| Tipo de texto | Caracteres por token | 512 tokens equivalen a |
|---|---|---|
| Prosa castellana | 5,32 | ~2.722 caracteres |
| Python con SQL y sangría | 2,73 | ~1.396 caracteres |

**El código consume el doble de presupuesto por carácter.** Un fragmento de 300 líneas ronda los 10.000 a 12.000 caracteres, así que se embeberían los primeros 35 a 40 renglones y el resto sería invisible para la búsqueda semántica.

Y lo que reencuadra la tensión entera, medido sobre el corpus vigente completo el 10/09:

```
notas vigentes: 558
tokens: min 30 · mediana 707 · media 797 · p90 1.429 · max 9.434
POR ENCIMA DE 512 TOKENS: 366 = 66 %
```

**Dos de cada tres notas vigentes tienen hoy el embedding calculado sobre un prefijo truncado, y nada en el sistema lo dice.** El código no crea este problema: lo empeora al doble por renglón y lo hace evidente. Ver el bloque 4, porque esto no es una tensión del cuaderno, es un defecto de Naeth que existe desde antes y merece su propio frente.

**c. Putrefacción: el diseño la ignora por completo, y ya estaba reconocido.**

No hay ningún campo que ate una nota a un commit, un fichero o una línea. Comprobado con `grep -rniE "commit|file_path|filepath|lineno|language|repo|sha1|blob"` sobre `schema.sql`, las migraciones, `core.py` y `mcp_server.py`: los únicos aciertos son la palabra `COMMIT;` de una transacción, un tag dentro de una lista y dos comentarios sin relación. Cero columnas.

Lo que existe y no sirve: `created_at` dice cuándo se escribió, no si sigue siendo cierto; la cadena de supersesión dice que alguien la corrigió, y solo si alguien fue a corregirla; y `metadata jsonb` (`schema.sql:40`) podría llevarlo pero está prácticamente muerta, porque **no se puede escribir por MCP** (ni `memory_add` en `mcp_server.py:256-260` ni `memory_supersede` en `:368-373` aceptan el parámetro), no está indexada, ninguna consulta la lee, y `memory_get` no la devuelve (`:351-356`).

La asimetría que hace esto distinto del caso conocido: una nota de prosa sobre una decisión envejece en meses y uno nota cuándo cambió de opinión, porque la cambió él. **Un fragmento de código deja de ser cierto en el commit siguiente**, hecho quizá por un agente, y nada avisa.

**d. Tamaño: resuelto para guardar, agravado para recuperar.** Ver la distribución del punto 1.1. Guardar no es el problema; el problema es el truncado del embedding del punto b. Hay además un choque de segundo orden: el tope de 300 caracteres del digest se calibró **sobre prosa**, con 24 digests reales de notas de 590 a 7.569 caracteres (`fase-4-0-tope-y-prioridad.md:15-27`), y el argumento que lo sostiene es que una nota larga no tiene más afirmaciones centrales sino más desarrollo de las mismas (`:29-30`). Ese argumento **no se ha probado sobre código**, donde 300 líneas sí pueden contener veinte afirmaciones independientes.

**e. Ruido: el diseño lo agrava por defecto, y la palanca es asimétrica.**

El espacio de búsqueda es uno solo: las tres consultas van contra `memory_current` (`core.py:325-358`), así que las 50 plazas de cada rama las compiten todas las notas. Hay filtros positivos pero **no hay filtro negativo ni exclusión**: `core.py:278-302` es el constructor entero y las tres consultas solo interpolan un `AND`. Consecuencia desagradable y asimétrica:

- Una búsqueda **de código** con `path_prefix='code/'` queda limpia.
- Una búsqueda **de cualquier otra cosa** queda contaminada por defecto, y quien busca no puede evitarlo aunque quiera.

Y la contaminación no es hipotética: como `'simple'` no descarta stopwords, los tokens genéricos del código (`for`, `id`, `is`, `not`, `null`, `select`) sobreviven en el índice, así que cualquier búsqueda en prosa que contenga esas palabras compite contra cada fragmento del cuaderno.

**El volumen decide cuándo duele.** 558 notas vigentes hoy, ritmo de 230 al mes (`naeth-ideas-2026-09-06.md:20`). Si el cuaderno se alimenta cada vez que se escribe código, puede superar al corpus de prosa en meses. Y ya está escrito que nada de lo que hoy funciona está probado a esa escala (`naeth-ideas:193-194`, idea P).

**Ruido secundario, el del vocabulario.** Como `memory_type` no tiene CHECK, un tipo `code` entra gratis en la base y **rompe cuatro listas de prosa a la vez**: el `CLAUDE.md` global, `web/src/views/Memoria.svelte:27`, `web/src/views/Nueva.svelte:36` y la descripción de la tool en `mcp_server.py:324-325`, más el mapa de formas del grafo. Y hay precedente medido: **`relation.predicate` tiene hoy cinco predicados en uso y la convención declara cuatro**. El quinto, `tested_by`, entró por la puerta de que el campo es texto libre. Un vocabulario sin CHECK se estrena solo.

### 1.3 El coste real de extender

**Un `memory_type` nuevo**: cero en la base, y el coste es de coherencia entre las cuatro listas de arriba. Está documentado que esas listas **ya se desincronizaron una vez**, llegando a decir tres cosas distintas (`plan-fases-2026-08-28.md:85`).

**Un campo nuevo**: cinco pasos, y el quinto es el caro. Las migraciones 003 y 006 dan el patrón medido:

1. `ALTER TABLE memory ADD COLUMN IF NOT EXISTS` (`006-digest.sql:33`). Trivial.
2. El CHECK con `DROP CONSTRAINT IF EXISTS` delante, para que relanzar no falle (`006:36-38`).
3. **`CREATE OR REPLACE VIEW memory_current` otra vez, obligatorio.** La vista es `SELECT m.*` y Postgres expande el asterisco al crearla, congelando la lista de columnas. Esto **falló en producción** el 28/08 con un `column digest does not exist` (`006:40-47`), y la migración 003 ya había pagado la misma factura (`003:29-35`). Los tests no lo cogen porque la base de test nace de `schema.sql`, donde la columna ya está dentro del `CREATE TABLE`.
4. Los índices si hacen falta, con el patrón de columna generada más btree ya establecido (`003:18-27`).
5. **La coordinación de los dos nodos.** `finally` primero y el PC después, porque el handoff crea la staging con `LIKE` y si el origen tiene la columna y el destino no, el `COPY IN` se lleva por delante el sync de la tabla `memory` entera. Además hay que levantar `default_transaction_read_only` solo para esa sentencia y comprobar que vuelve. Y el backfill no viaja en el sync, así que son dos ejecuciones, una por nodo (`006:18-29`).

**Una tabla nueva es bastante más cara**: el `classify()` del `sync.py` de CENIT aborta el sync ante cualquier tabla del esquema sin clasificar, y eso ya tumbó la idea de un `memory_knn` cacheado (`naeth-ideas:286-288`).

**Y la mitad que se olvida es la lectura.** Aunque el dato esté en la columna, no cruza al agente si no se añade a mano al dict de salida, que es fijo en `_hit` (`mcp_server.py:301-313`) y en `memory_get` (`:351-356`). La prueba de que esto se olvida: **`memory_get` hoy no devuelve `digest` ni `metadata`**, aunque las dos columnas existan y estén pobladas.

### 1.4 Precedentes: no hay pensamiento previo sobre código, y hay cinco piezas aplicables

**Nadie ha pensado nunca en meter código en Naeth.** Comprobado: `grep -rni 'snippet' docs/plan/` cero, `grep -rni 'cuaderno' docs/plan/` cero, `grep -rniE 'patrón de código|ejemplo de código|code example' docs/plan/` cero. Los aciertos de una búsqueda más ancha son todos ajenos: snippets de Pencil, auditoría de licencias, notebooks de Cognee.

Pero hay cinco investigaciones previas que la metodología obliga a reusar antes de escribir nada:

1. **Idea F, "qué haría falsa a esta memoria"** (`naeth-ideas:110-121`; `mapa.md:81`, marcada `listo` y calificada de **la más rentable de la lista**). Es la tensión (c) ya planteada, con protocolo de medición definido. Y para código **la condición se escribe sola**, porque es el hash del fichero. El cuaderno es el caso de prueba que la idea F estaba pidiendo, y a la vez la idea F es lo único que impediría que el cuaderno se pudra.
2. **Idea L, la anotación al margen** (`naeth-ideas:166-170`; `mapa.md:92`). El cuaderno dice "revisarlo, documentarlo", y una revisión de un fragmento es un comentario sobre él, no una versión nueva de él. Hoy la única forma de comentar algo es superseder, que es demasiado ceremonioso para una duda. Son el mismo mecanismo.
3. **Idea N, adjuntos** (`naeth-ideas:178-182`; `mapa.md:94`). La tabla `attachment` ya existe con `filename`, `mime`, `sha256`, `storage_path`, `extracted_text` y un `memory_id` sidecar (`schema.sql:93-104`). **Es la estructura existente más parecida a "un fichero más una nota sobre él", lleva creada desde junio y está vacía**: aparece una sola vez en todo el código, en la lista de truncado de los tests (`app/tests/conftest.py:26`). Antes de inventar columnas hay que mirar por qué no sirve, o si sirve.
4. **Idea B, registro de lecturas** (`naeth-ideas:54-67`; `mapa.md:72`). Ya está comprobado contra `information_schema` que ninguna tabla registra accesos ni búsquedas (`fase-4-0:97-101`). El propósito declarado del cuaderno es que sea consultable, y **sin esto no habrá forma de saber si se consulta**, o sea de saber si funciona. Y la señal más valiosa que hoy se tira está señalada: los hits dicen lo que Naeth tiene, las búsquedas vacías dicen lo que le falta (`naeth-ideas:60-61`).
5. **`fase-4-0-tope-y-prioridad.md` entero, como método.** Es el registro de cómo se decidió el tamaño de un campo escribiendo 24 casos reales y midiendo, no eligiendo entre 200 y 400, con el sesgo de anclaje documentado (`:37-47`) y la asimetría que decidió el número (`:64-74`: relajar un CHECK después es gratis, apretarlo obliga a reeditar a mano). Si el cuaderno necesita cualquier campo acotado, el protocolo ya está escrito.

Y una sexta que es el diagnóstico devuelto: **idea O, "Naeth escribe lo que se demuestra"** (`naeth-ideas:184-189`; `mapa.md:95`, marcada `bloqueado` por cara). Descrita como la vacuna contra el patrón registrado tres veces de que un documento propio afirma algo, nadie lo comprueba, y acaba sosteniendo un precio. **Dejar de revisar el código que escriben los agentes es ese mismo patrón en otro sitio.**

### 1.5 Intersección con el roadmap de producto

**No encaja en ninguna de las seis fases.** La fase 1 toca CENIT y no `naeth/`; la fase 2 dice literalmente que no toca código de aplicación (`roadmap-producto-2026-09-09.md:62`); las fases 3 a 5 son identidad, cara pública y multi-usuario. Su sitio es lo que el roadmap llama lo que sigue vivo en paralelo (`:150-158`), y por el vocabulario de estados de `mapa.md:29-31` sería un **frente**, abierto y sin investigar.

**Dónde choca**: el peaje de migración multi-nodo se pagaría ahora, antes de que exista la separación plataforma e instancia que lo haría repetible; el riesgo número uno del roadmap es que la fase 1 rompa la instalación de Eneko, y un cambio de esquema en medio mete una segunda pieza móvil en la única prueba que valida esa fase; y cada consulta nueva engorda las 31 consultas que la fase 5 tiene que tocar una a una (`roadmap:126`).

**Dónde ayuda**: la fase 4 necesita una demo pública y tiene escrito que nunca se enseña el corpus de Eneko, porque su valor viene de escribir con franqueza sobre precios, clientes y personas (`roadmap:115-116`). **Un cuaderno de código es la única parte del corpus que se puede enseñar entera.** Y es de las pocas cosas del mapa que cualquier desarrollador que instale Naeth querría, no solo él, que es justo el principio rector de que el producto final sea el mismo que Eneko usa (`roadmap:19`).

**Y un argumento de secuencia**: la fase 2 entrega un compose que define su propio Postgres (`roadmap:65`), así que después de la fase 2 el peaje multi-nodo deja de ser obligatorio para probar. **Hacer el cuaderno después de la fase 2 es estrictamente más barato que hacerlo antes.**

---

## 2. Disparadores: qué existe de verdad en el harness

Verificado contra la documentación oficial (https://code.claude.com/docs/en/hooks) después de que la primera investigación trajera errores.

**Hay unos 32 eventos de hook, no una docena.** Entre los que la primera pasada se dejó hay uno directamente relevante: **`FileChanged`**, que dispara cuando cambia en disco un fichero vigilado, con un matcher de nombres de fichero. **Solo entrega la ruta, no el contenido.** Otros que importan: `PostToolBatch`, `SubagentStart` y `SubagentStop`, `PostToolUseFailure`, `Setup`, `PermissionRequest`.

**Qué puede devolver un hook.** Un hook de `PostToolUse` puede emitir JSON con `additionalContext` y `systemMessage`, así que **puede meter texto en el contexto del modelo y hacerle reaccionar**. Ojo con el matiz: el stdout en texto plano solo se convierte en contexto para `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart` y `PostModelSwitch`; para el resto hay que usar la salida JSON. También existe `updatedInput` para eventos de herramienta, que permite modificar los argumentos.

**`exit 2` no significa lo mismo en todas partes**, y esto decide qué se puede bloquear:

| Evento | Qué hace `exit 2` |
|---|---|
| `PreToolUse` | Bloquea la llamada a la herramienta |
| `UserPromptSubmit` | Bloquea el prompt y lo borra |
| `Stop` | Impide que el modelo pare, y la conversación sigue |
| `SubagentStop` | Impide que el subagente pare |
| `TaskCreated` | Revierte la creación de la tarea |
| `TaskCompleted` | Impide marcar la tarea como completada |
| `StopFailure` | Se ignora la salida y el código |

⚠ **No verificado, y es la pieza de la que depende el diseño**: si el payload de un `Edit` incluye el texto anterior y el nuevo. Es casi seguro que sí, porque son los argumentos de la propia herramienta, pero la documentación consultada no detalla el esquema de `tool_input` por herramienta. Se comprueba en cinco minutos con un hook que vuelque su stdin a un fichero.

**Los tres límites que condicionan el diseño:**

1. **No existe disparador de fin de sub-fase.** La sub-fase es un concepto del plan, no del harness. Lo más cercano es `TaskCompleted`, que depende de que se marque explícitamente, y `Stop`, que es cuando el modelo decide parar. `Stop` es el candidato realista, porque parar suele coincidir con haber terminado una unidad de trabajo.
2. **Un hook no puede forzar que se cargue una skill.** Solo puede sugerirlo inyectando contexto, y el modelo decide. Si se quiere garantía, la garantía tiene que ser mecánica, o sea un hook que bloquee, no una skill que se invoque.
3. **`PostToolUse` corre después de que la escritura ya ocurrió.** Puede dar feedback pero no revierte. Para bloquear de verdad hay que estar en `PreToolUse`.

---

## 3. Estilo: qué palanca muerde y cuál no

Ordenado por cuánto muerde, de menos a más:

| Palanca | Qué hace | Límite real |
|---|---|---|
| **Output styles** | Cambian tono y verbosidad de la **respuesta** | **No tocan el código.** Descartado para esto |
| **Skills** | Cargan bajo demanda, no queman contexto | El modelo tiene que acordarse de invocarla, y un hook no puede forzarla |
| **`CLAUDE.md`** | Se carga como contexto en cada sesión, con precedencia por orden de carga | Es contexto, **no es imposición**. Funciona con reglas concretas y falla con reglas vagas |
| **Hooks de lint y formato** | Ejecución mecánica, garantizada | Solo alcanza lo mecanizable, ver abajo |

**Y el hallazgo que importa para lo que Eneko quiere de verdad:**

| Tipo de regla | ¿Mecanizable? |
|---|---|
| Sangrado, comillas, saltos de línea, nombres | **Sí**, con ruff, prettier, eslint |
| Longitud de función, complejidad | **Sí**, con reglas del linter |
| "Cada función tiene test" | Parcial: se comprueba que el fichero existe, no que el test valga |
| "Comenta por qué, no qué" | **No** |
| "Usa este patrón en vez de este otro" | **No** |

**Cuanto más arquitectónico y semántico es el estilo, menos se puede mecanizar.** Y el estilo que Eneko dice querer no es el sangrado: es que el código lleve la decisión escrita al lado, como el comentario que explica que trece procesos de Mongo peleándose tiraban 63 tests, o el que justifica el orden de los campos de un índice compuesto. **Eso no lo impone ningún linter.** Solo se consigue con un estilo documentado más revisión, que es exactamente el bucle que el cuaderno quiere crear.

Su hook `py-lint.ps1` de Naeth es el patrón correcto para la mitad mecanizable, y ya está montado.

---

## 4. Hallazgos que no buscábamos

Tres cosas aparecieron de lado y no dependen del cuaderno.

**1. El 66% de las notas vigentes tienen el embedding truncado.** Medido el 10/09: 366 de 558 notas superan los 512 tokens que el modelo acepta, y fastembed trunca sin avisar. Verificado con control positivo, dos textos que solo difieren en la cola devuelven el mismo vector bit a bit. Esto significa que **la segunda mitad de dos de cada tres notas no existe para la búsqueda semántica**. Es la misma familia de fallo que el worker que perdía memorias en silencio: la nota está, se lee, se encuentra por texto, y no aparece donde debería. Merece frente propio y es independiente de todo lo demás de este documento.

**2. `unescapeMarkdown` no protege los bloques de código.** Ver 1.2.a. Sus dos funciones hermanas sí lo hacen. Es una línea de diferencia y corrompe escapes dentro de vallas al guardar desde el visor. Sin verificar sobre un caso real, comprobable en un minuto.

**3. El vocabulario de relaciones ya se desbordó.** Cinco predicados en uso contra los cuatro que declara la convención; el quinto es `tested_by`. Es la evidencia de que un vocabulario sin restricción en la base se estrena solo, y es exactamente lo que pasaría con `memory_type='code'`.

**Y dos desajustes menores**: el corpus vigente son 558 notas, no 551 (un día de crecimiento, `mapa.md:11` decía 551 el 09/09). Y `README.md:170` dice que Naeth corre en un solo nodo y que el multi-nodo es el siguiente paso, cuando lleva con failover desde julio. Si la fase 4 enseña ese README, enseña una frase falsa.

---

## 5. Lo que esta investigación descarta

- **Medir el deterioro con git.** No se puede, y no por falta de rigor: git no registra quién escribió cada línea y no hay comparación temporal limpia entre repos. No repetir.
- **Output styles para el estilo de código.** No tocan el código.
- **Un hook que invoque una skill.** No existe.
- **Un disparador nativo de fin de sub-fase.** No existe.
- **Confiar solo en `CLAUDE.md` para imponer estilo.** Es contexto, no imposición.
- **Meter código en el mismo espacio de búsqueda sin aislarlo.** Los filtros son solo positivos, así que la contaminación de las búsquedas de prosa sería por defecto e inevitable para quien busca.

---

## 6. Lo que queda para fase 2, y no antes

Las preguntas que la fase 2 tiene que responder, ninguna respondida aquí a propósito:

1. **¿Antes o después de la fase 2 del roadmap?** El argumento de secuencia dice que después es estrictamente más barato.
2. **¿Columna nueva, `metadata` revivida, o la tabla `attachment` que ya existe?** Hay que mirar `attachment` antes de inventar nada.
3. **¿Cómo se aísla el cuaderno de las búsquedas de prosa,** dado que no hay filtro negativo? Es la decisión que más condiciona el resto.
4. **¿Qué se hace con el truncado de 512 tokens?** Afecta al cuaderno el doble, pero es un problema anterior y mayor.
5. **¿Qué disparador, o qué combinación?** Con el aviso de la regla del 15/08: mientras haya que acordarse de abrir el cuaderno, compite con improvisar y pierde.
6. **¿Cuál es su estilo real?** No está destilado, y el intento de medirlo por densidad de comentarios no distinguió épocas. Habría que destilarlo leyendo código suyo, no contando líneas.

**La regla que gobierna la fase 2**, y es suya, del 15/08 (Naeth `cf1f596b`): un entregable de consulta compite contra hacerlo a pelo, y hacerlo a pelo siempre está a mano. El playbook de prompting se cerró con nueve plantillas buenas y a los cuatro días no se había usado ninguna, y la causa no era criterio ni disciplina, era dónde vivía. La segunda mitad de esa regla es la que muerde aquí: el acceso es condición necesaria y no suficiente, porque lo que elimina la consulta es que la pieza se dispare sola.

**Traducido a este proyecto: un cuaderno que haya que recordar consultar no se consultará, porque el momento en que no te acuerdas de algo es exactamente el momento en que preguntarle a un agente es más barato.** El disparador no es un detalle de implementación, es lo que decide si el cuaderno existe dentro de un mes.

---

## 7. Sin verificar

- Si el payload de un `Edit` lleva el texto anterior y el nuevo. Cinco minutos con un hook que vuelque su stdin.
- Si `unescapeMarkdown` corrompe de verdad un bloque de código guardado desde el visor. Un minuto, pero exige escribir una nota.
- Qué normaliza exactamente Milkdown al cargar. D7 sigue siendo hipótesis, no diagnóstico.
- Si un digest de 300 caracteres puede describir un fragmento de código. El tope se calibró sobre prosa y nadie ha escrito ninguno sobre código.
- Si la similitud del corpus, ya comprimida (mediana 0,874 entre pares al azar, `core.py:476-481`), empeora al meter código. Medible con el método de `graph_knn`, no medido.
- Cuántas búsquedas se hacen al día. No hay registro de ninguna clase, así que el impacto de ruido solo se puede estimar sobre el corpus, no sobre el uso real.
