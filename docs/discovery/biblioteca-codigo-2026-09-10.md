# Biblioteca de código: discovery

**Fecha**: jueves 10/09/2026, de 19:04 a 20:00.
**Sustituye el marco de** [`../plan/cuaderno-codigo-fase1-2026-09-10.md`](../plan/cuaderno-codigo-fase1-2026-09-10.md) y
[`../plan/cuaderno-codigo-fase2-2026-09-10.md`](../plan/cuaderno-codigo-fase2-2026-09-10.md), que se
escribieron para un "cuaderno" de fichas y quedaron reencuadrados a las 18:38. Lo que de ellos sigue
valiendo se cita; lo demás no se repite.
**Qué es**: fase 1 de la metodología, investigación antes de tocar nada, con el marco que Eneko dio a las
18:38 y afinó a las 19:04. Todo lo medido es del 10/09 contra el disco, con el comando al lado. Lo no
confirmado va marcado `⚠ sin verificar`.

---

## 0. El marco, en seis puntos suyos y tres respuestas

Lo que quiere, con sus palabras resumidas:

1. **Que el código se escriba como le gusta a él**, y que yo codifique así.
2. **Comentar al dedillo, con Doc** (docstrings, JSDoc), para generar documentación automática. Es lo que
   abandonó al dejar de revisar código.
3. **Una biblioteca con todo su código**, apartado propio de Naeth, que sirva de sitio de consulta y de
   documentación, para él y para los agentes.
4. **Una llamada nueva para bloques de código.** `memory_get` y lo montado no valen para esto.
5. **Almacenar mucho código de forma eficiente, y solo lo importante.** Un bloque de CSS o HTML repetible
   no entra.
6. **Con seriedad y sin tope de horas.** El motivo es entender todo lo que hace para poder responder en
   una entrevista de Backend Python sin preguntarle a nadie.

Y las tres respuestas de las 19:04: la `x` de "Naeth/x" es solo un apartado, el nombre no importa ahora;
el **idioma depende del repo** y un sistema de traducción puede ser útil; y el ejemplo de GridWatch de
2025 es cómo documentaba entonces, **lo que importa es usar Doc**, y cómo documentar lo decide cuando lo
vea.

Del cuaderno sobreviven, y se citan donde toca: el aislamiento de la búsqueda de prosa, el hash del
fichero como aviso de putrefacción, el hook de `Stop` que obliga a revisar al final de un turno con
código, y los criterios de qué merece explicación larga.

---

## 1. Lo que hay hoy, medido

### 1.1 Cuánto código, y de qué

Caracteres de fuente por árbol, sin tests, sin `.d.ts` (`find ... | xargs cat | wc -c`):

| Árbol | Caracteres | Lenguaje | Comentarios en |
|---|---|---|---|
| `naeth/app` | 94.654 | Python | Castellano |
| `naeth/web/src` | ~10.500 líneas, TS y Svelte | TypeScript | Castellano |
| CENIT `cenit_core` | 176.155 | Python | Castellano |
| CENIT `core/ops` | 83.593 | PowerShell y sh | Castellano |
| Yogin-API `src` | 366.444 | JavaScript (`.mjs`) | Castellano |
| Yogin-Website `src` | 1.449.492 | React (`.jsx`) | Castellano |
| GridWatch `ClientApp/src` | 329 ficheros TS y TSX | TypeScript | **Inglés** |

Para escala: el corpus de prosa de Naeth son 558 notas de 2.640 caracteres de media, unos 1,47 MB. **Todo
el Python propio, Naeth y CENIT juntos, son 271 KB**, el 18% del corpus. "Mucho código" no es un problema
de almacenamiento; es un problema de ruido en la búsqueda y de ventana del embedding, ver 1.4 y 4.

### 1.2 Cuánto está documentado, y cómo

Python, medido con `ast` sobre cada módulo (`scratchpad/doccov.py`; se conserva el resultado, el script
es desechable):

| Módulo | Líneas | Funciones con docstring | Comentarios `#` |
|---|---|---|---|
| `naeth/app/core.py` | 722 | 19 de 25 | 69 |
| `naeth/app/mcp_server.py` | 632 | 10 de 41 | 70 |
| `naeth/app/oauth.py` | 277 | **1 de 30** | 9 |
| `naeth/app/worker.py` | 174 | 4 de 5 | 9 |
| `naeth/app/embeddings.py` | 54 | 3 de 5 | 1 |
| **`naeth/app` total** | 1.869 | **37 de 106 (35%)**; 6 de 6 módulos con cabecera | |
| `cenit_core/sync.py` | 405 | 14 de 14 | 66 |
| `cenit_core/identity_sync.py` | 207 | 9 de 9 | 46 |
| `cenit_core/cli.py` | 961 | 20 de 23 | 44 |
| `cenit_core/handoff.py` | 448 | 5 de 17; clases 3 de 7 | 27 |
| `cenit_core/watchdog.py` | 217 | 5 de 12 | 33 |
| `cenit_core/pocketid.py` | 106 | 2 de 9 | 0 |
| **`cenit_core` total** | 3.746 | **100 de 149 (67%)**; clases 12 de 35; 16 de 16 módulos | |

Los símbolos grandes sin docstring son pocos y están localizados: `mcp_server._build_auth` (29 líneas),
`oauth.login_post` (36), `oauth._issue` (24), `worker.main` (26), `config.CoreConfig` (22),
`pocketid.create_client` (22), `status.check_module` (31). El resto de lo que falta son funciones de
menos de 20 líneas, y muchas son las 41 tools y rutas de `mcp_server.py`, cuya documentación vive en la
`description` del decorador y no en el docstring.

JavaScript y TypeScript:

- **Yogin-API**: 5 bloques `/** */` en todo `src` (`grep -rc "/\*\*"`). Los comentarios son `//` en
  castellano, abundantes y buenos (`events.mjs` tiene 20 marcadores de decisión), pero **ninguna
  herramienta los puede extraer**: no son Doc.
- **GridWatch**: 424 bloques JSDoc en 329 ficheros, en inglés, con `@fileoverview`, `@module` y
  `@param`, y el grueso viene de la pasada del 06/06/2025 (`997e4f1`, 65 ficheros). Es el "al dedillo"
  que menciona, y es el único repo donde la documentación ya es extraíble.

**Ningún repo tiene herramienta de documentación**: `grep pdoc|sphinx|mkdocs|typedoc|jsdoc` sobre
`requirements*.txt`, `pyproject.toml` y los `package.json`: cero.

### 1.3 Cómo son los docstrings que sí existen

Se volcaron los 43 docstrings de `core.py`, `worker.py`, `mcp_server.py`, `sync.py`, `handoff.py` y
`ownership.py` (`scratchpad/doc-core.txt`, `doc-cenit.txt`, 495 líneas) y se leyeron enteros. Lo que se
repite, que es el estilo, va en §2. El dato que importa aquí: **los docstrings buenos ya llevan la
explicación larga dentro**. `graph_edges` tiene 25 líneas de docstring con dos avisos y una medición
(`core.py:410`); `recycle_connections_sql` tiene 24 con el incidente del 26/07 contado entero
(`ownership.py:256`); `claim_batch` lleva el "POR QUÉ EL LEASE" con fecha (`worker.py:61`). Once
docstrings de `naeth/app` y 23 de `cenit_core` pasan de 400 caracteres. Eso reencuadra la pregunta del
reparto entre código y Naeth: ver §3.

### 1.4 El tamaño de un símbolo, y cuántos caben en el embedding

Caracteres por símbolo (función o clase), `scratchpad/chars.py`:

| Árbol | Símbolos | Mediana | p90 | Máximo | Caben enteros en 1.400 caracteres | En 2.800 |
|---|---|---|---|---|---|---|
| `naeth/app` | 107 | 431 | 1.596 | 7.813 (`NaethOAuthProvider`) | **89 (83%)** | 103 |
| `cenit_core` | 184 | 454 | 2.049 | 7.659 (`cli.owner_recover`) | **152 (83%)** | 172 |

1.400 caracteres es lo que entra en la ventana de 512 tokens del modelo de embeddings para código (2,73
caracteres por token, medido en la fase 1 del cuaderno, §1.2.b). **Cinco de cada seis símbolos se
embeben enteros si el bloque es el símbolo y no el fichero.** Los 50 que no caben son justo los que
importan: `search`, `run_handoff`, `watchdog.decide`, `_stats_hygiene`, `owner_recover`. Para esos, lo
que la búsqueda semántica ve es el principio del bloque, así que **la explicación tiene que ir delante
del código**, y es donde una capa escrita a mano encima del docstring paga más. Esto no arregla el
truncado del 66% de la prosa, que sigue siendo frente propio; lo esquiva.

Por longitud en líneas, sobre los 291 símbolos: 99 tienen 5 líneas o menos (34%), 166 tienen 10 o menos,
229 tienen 20 o menos. Un tercio son triviales: getters, wrappers, `argv` de un comando. Ver §4.

### 1.5 Lo que un extractor estático da gratis: prueba con `griffe`

`griffe` es el motor de `mkdocstrings`, analiza Python **sin importarlo**, así que no necesita psycopg
ni fastmcp instalados. Ejecutado sobre `naeth/app` desde `naeth/` con `uvx --from griffe griffe dump app
-s . -o griffe-app.json`: 4 paquetes instalados, JSON de 336 KB, 82 símbolos de primer nivel. Por cada
función devuelve: `kind`, `name`, `lineno`, `endlineno`, `docstring` (con sus propias líneas),
`parameters` con anotaciones, `returns`, `decorators` con sus argumentos (incluida la `description` de
`@mcp.tool`, entera), y a nivel de paquete `git_info` con `commit_hash`, `remote_url` y `repository`.

Es decir: **el modelo de bloque de código que la biblioteca necesita ya lo produce una herramienta de
serie**, con commit incluido. Lo que no da es el fragmento de código en sí (se recorta del fichero con
`lineno` y `endlineno`), el sha del fichero, el slug del repo ni ninguna capa escrita a mano. Para JS y
TS el equivalente es TypeDoc o el propio parser de JSDoc ⚠ sin probar; para PowerShell y sh no hay
extractor estándar y esos scripts irían a mano, que es asumible: son 25 ficheros.

---

## 2. El estilo, destilado de sus docstrings

Leído en los 43 docstrings volcados. No es lo que dice que le gusta: es lo que hace cuando documenta
bien. Se presenta como **borrador de guía**, para que decida al verlo, como pidió.

**Estructura de un docstring suyo, cuando está completo:**

1. **Primera línea: qué hace, en una frase, y qué devuelve.** "Reclama hasta `n` jobs: los pendientes y
   los HUÉRFANOS" (`worker.py:61`). "'merge' | 'directional' | 'local' | 'view'. SyncError si la tabla
   es desconocida" (`sync.py:129`).
2. **Línea en blanco y el porqué, en párrafo.** No repite el qué: explica la decisión. "Deliberadamente
   NO tiene default: una tabla nueva en el schema debe forzar una decisión explícita" (`sync.py:129`).
3. **La alternativa descartada, y qué pasaría con ella.** "Con LEFT JOIN más coalesce, una relación cuyo
   extremo está TOMBSTONEADO resuelve a sí misma y el grafo acaba pintando nodos que ya no existen"
   (`core.py:410`). "Reiniciar el módulo costaría el warmup del modelo, un minuto justo en el instante
   del relevo" (`ownership.py:256`).
4. **El incidente real con fecha, cuando lo hay**, a veces enmarcado con una línea de guiones: "POR QUÉ EL
   LEASE (fallo real, 2026-07-26)" (`worker.py:61`), "EL FALLO QUE HUNDIÓ LA PRIMERA PRUEBA DEL CICLO
   (P8, 2026-07-26)" (`ownership.py:256`), "LA VENTANA QUE ESTO CIERRA (vista en el ciclo real de P8)"
   (`sync.py:367`).
5. **El número medido, con fecha.** "Medido con EXPLAIN ANALYZE el 04/09/2026: 5,1 ms" (`core.py:410`).
   "julio 119/129, agosto 343/343" (`mcp_server.py:230`). "la versión con coalesce daba 489 aristas y la
   correcta 479" (`core.py:410`).
6. **El aviso, con `⚠` y en MAYÚSCULAS lo que no se debe tocar.** "⚠ EL DIGEST NO ENTRA EN EL
   content_hash" (`core.py:88`). "⚠ NO BASTA POR SÍ SOLO: esto solo lo ven las conexiones NUEVAS"
   (`ownership.py:225`).
7. **La referencia cruzada al sitio que completa la historia**: "Ver `recycle_connections_sql`, es la
   mitad que faltaba" (`ownership.py:225`); "Es el mismo criterio instructivo de `_enforce_model`"
   (`core.py:69`); "Paso 6 §9", "CENIT 8.6", "fase 4".

**Rasgos de voz**: castellano sin tildes en Naeth (por el teclado de la época) y con tildes en CENIT;
mayúsculas para la palabra que carga la frase, no para gritar; el "o sea" que traduce el mecanismo a
consecuencia; frases que empiezan por la conclusión ("NO ES OPCIONAL, y es el fallo más caro de 8.3");
el precio de la decisión dicho explícitamente ("El precio es que una petición en vuelo puede fallar").

**Lo que NO hay en sus docstrings buenos, y conviene saberlo antes de elegir generador**: secciones
`Args:` / `Returns:` / `Raises:`. Los parámetros se explican en prosa cuando importan y se omiten cuando
la firma ya lo dice. Los generadores de documentación (pdoc, mkdocstrings, Sphinx) esperan un formato
(Google, NumPy o reST) y pintan bonito lo que lo sigue; lo que no lo sigue lo pintan como un párrafo.
**Conviven**: la narrativa primero, tal cual la escribe, y una sección `Args:` corta al final solo cuando
un parámetro no es evidente. Se decide probándolo sobre tres funciones, no en abstracto (§6).

**Lo que sí tiene GridWatch 2025 y Naeth no**: `@fileoverview` con la lista de "Features" del fichero y
`@module` con la ruta (`MapContainer.tsx`, commit `997e4f1`). Es documentación de **qué hay**, para quien
llega nuevo; la de Naeth es documentación de **por qué es así**, para quien va a tocarlo. La biblioteca
necesita las dos, y son dos niveles distintos: fichero y símbolo.

---

## 3. Fuente de verdad, con reparto: lo que la medición dice del reparto

Le atrae "las dos, con reparto": docstring en el código y explicación larga en Naeth. La medición de 1.3
dice que **hoy el reparto es "todo en el código"**: los mejores porqués, incidentes y mediciones ya están
en el docstring. Y eso es bueno: viven con el código, cambian en el mismo commit, y `git blame` los data.

Entonces el reparto no es "qué en el código y qué en Naeth", sino **qué es fuente y qué es derivado**:

| Capa | Dónde nace | Quién la escribe | Ejemplo |
|---|---|---|---|
| **Qué hace, contrato, por qué, avisos** | Docstring o JSDoc en el código | Él, o un agente con la guía de §2 y revisión | Todo lo de 1.3 |
| **Qué hay en el fichero** | Cabecera del módulo | Igual | `@fileoverview` de GridWatch; las cabeceras de `sync.py` |
| **El bloque de la biblioteca** | Extraído del código (griffe, TypeDoc) | La máquina, en una pasada | Firma, líneas, docstring, commit, sha, fragmento |
| **La capa de Naeth encima** | Naeth, ligada al bloque | Él o un agente, tras revisar | Relación con la decisión de prosa que lo explica; "leí esto el 6/9 y no me cuadra" (idea L); marca de "importante"; el resumen escrito a mano para los 50 bloques que no caben en el embedding |

Con esto, **la biblioteca no se pudre por diseño**: el bloque se regenera del código en cada pasada y
lleva el commit; solo la capa de Naeth puede quedarse vieja, y para eso está el hash del fichero (plan
del cuaderno, 1.3 y 1.4). Y el trabajo de "comentar al dedillo" va **al código**, que es donde él lo
quiere y donde una entrevista lo encontraría.

Lo que esto descarta: escribir fichas de código a mano en Naeth como fuente principal. Sería la segunda
copia de lo que el docstring ya dice, y las dos copias se separan.

---

## 4. Qué entra, con la cabeza fría: números para decidir

Pidió medirlo como se hizo con Naeth. Sobre los 291 símbolos Python de hoy:

| Regla candidata | Cuántos entran hoy | Qué deja fuera | Problema |
|---|---|---|---|
| Todo símbolo | 291 | Nada | Un tercio son triviales (99 de 5 líneas o menos): `argv` de comandos, getters, `_json`. Ruido |
| Todo símbolo **con docstring** | 150 (37 + 100 + clases) | Los 141 sin documentar | Es circular en el buen sentido: **documentar es lo que hace entrar**. Cuando `oauth.py` se documente, entra. La regla empuja hacia el punto 2º |
| Con docstring **y** más de 5 líneas | **131** (36 en `naeth/app`, 95 en `cenit_core`); con más de 10 líneas, 100 (28 + 72) | Los wrappers documentados de una línea | Filtra lo trivial sin juicio. Medido cruzando las dos columnas con `ast` |
| Solo lo curado por los criterios del cuaderno | Decenas | Casi todo | Es la capa de encima de §3, no el filtro de entrada: si solo entra lo curado, no hay biblioteca, hay cuaderno |

**Lo que la medición sugiere, para que él decida**: el filtro de entrada es **tener Doc** (regla 2, quizá
con el mínimo de líneas de la regla 3), y "lo importante" no es un filtro sino una **marca** en la capa
de Naeth (`kind`: mecanismo, porqué, receta, aviso, estilo; criterios del cuaderno §2). Así el CSS
repetible queda fuera porque nadie lo documenta, y lo importante se distingue sin que nadie tenga que
decidir por adelantado qué es todo lo demás.

Escala prevista con esa regla: Python entero documentado, unos 190 bloques (291 menos los triviales);
Yogin-API, hoy con 5 JSDoc, entraría casi de cero y crecería a medida que se documente; GridWatch
entraría con sus 424 bloques de golpe si se quiere, en inglés. Nada de esto se acerca al tamaño de la
prosa.

**Lo repetible y aleatorio no entra por construcción**: un bloque de CSS no tiene símbolo ni docstring
que extraer. Un componente Svelte o JSX sí puede tener cabecera, y entra si la tiene.

---

## 5. El bloque de código y la llamada nueva

### 5.1 Qué es un bloque

De lo que griffe da (1.5) más lo que falta:

| Campo | Origen | Nota |
|---|---|---|
| `repo` | Slug fijado por el extractor | `naeth`, `cenit`, `yogin-api`, `gridwatch` |
| `file` | Ruta relativa a la raíz del repo | |
| `symbol` | Nombre cualificado | `app.core.search`, `cenit_core.sync.classify` |
| `kind` | function, class, method, module, script | |
| `lang` | Lenguaje | Decide el extractor y el resaltado |
| `signature` | Parámetros y retorno | De griffe |
| `lines` | `lineno` a `endlineno` | |
| `doc` | El docstring o JSDoc, tal cual | **Fuente de verdad, no se edita en Naeth** |
| `doc_lang` | Idioma del docstring | `es` o `en`, por repo |
| `doc_translated` | Traducción generada, si la hay | Derivada y marcada como tal, ver 5.3 |
| `source` | El fragmento entero | Recortado del fichero |
| `commit`, `file_sha256` | Del repo al extraer | Lo que dice si el bloque sigue siendo verdad |
| `extracted_at` | Fecha de la pasada | |
| `content_hash` | De `source` + `doc` | Idempotencia: la misma pasada dos veces no duplica |

Y la capa de Naeth encima, separada del bloque: `importance` o `kind` curado, el resumen a mano, las
relaciones a notas de prosa, las anotaciones de lectura (idea L). Es ADD-only como todo lo demás: un
bloque nuevo por cada extracción cuyo hash cambie; el anterior queda como historia de esa función, que es
justo la definición de Naeth del 26/08 ("cada cosa conserva todos sus estados anteriores").

### 5.2 Tabla propia o `memory` con path `code/`

El plan del cuaderno eligió `memory` con path para no tocar esquema. Con el marco nuevo, la balanza
cambia y **la tabla propia gana**, por estas razones medidas:

- **El modelo no es el de una nota.** Firma, líneas, símbolo, commit, sha, fuente y doc son campos con
  forma; en `metadata jsonb` serían un JSON sin índice ni CHECK que "se estrena solo" (precedente
  `tested_by`).
- **El aislamiento pasa a ser estructural.** Sin bloques en `memory`, la búsqueda de prosa no necesita
  filtro negativo ni un índice HNSW parcial (riesgo del plan del cuaderno, 1.2). La tool nueva busca en
  su tabla; `memory_search` no cambia.
- **La ingesta es masiva y repetible.** Doscientos bloques por pasada en `memory_current` inflarían el
  árbol, el grafo y `memory_stats` cada vez que se regenera; en su tabla, el grafo los ve solo si se
  decide enseñarlos.
- **El versionado es por commit, no por supersesión.** Un bloque nuevo cuando cambia el código; no hace
  falta la cadena `supersession`, que está pensada para correcciones de prosa.

Lo que cuesta, y no es poco, para que no sorprenda:

1. **Clasificarla en el sync de CENIT antes de crearla**, no después: `classify()` no tiene default y
   `preflight` aborta el handoff ante una tabla sin clasificar (`sync.py:129-147`, `:332`). Es una línea
   en `MERGE_TABLES` (`sync.py:82-88`), con PK uuid, y tiene que estar desplegada en el reconciler de los
   dos nodos **antes** del `CREATE TABLE`. El orden inverso repite el incidente de `_emdash_backup` del
   30/07.
2. **El embedding**: la cola `job` ya prevé otros `kind` ("embed|extract|...", `schema.sql:112`), pero el
   worker solo procesa `memory` (`worker.py:104`). O se generaliza el worker, o los bloques se embeben en
   la pasada de extracción. Es la decisión técnica más grande de la fase 2.
3. **Migración en dos nodos**: `CREATE TABLE IF NOT EXISTS`, sin tocar `memory_current` ni columnas de
   tablas existentes, así que no aplica la trampa de la vista ni la de la staging con `LIKE`. Sigue
   habiendo que levantar el read-only en el nodo que no manda para esa sentencia.
4. **Los tests**: la lista de tablas que se truncan (`app/tests/conftest.py:26`) y el `TABLAS` de
   `test_handoff.py:21` de CENIT.

### 5.3 La llamada nueva

Lo que él pidió: que no sea `memory_get`. Contrato mínimo a probar en fase 2, sin nombres cerrados:

- **`code_search(query, repo?, lang?, kind?, k)`**: híbrida como la de prosa, sobre `doc` y `source`, y
  devuelve símbolo, fichero, líneas, la primera frase del doc y si el bloque está al día con el repo.
- **`code_get(id | repo+symbol)`**: el bloque entero con su doc, su fuente y su capa de Naeth.
- **`code_list(repo, file?)`**: el índice de un fichero o un repo, que es lo que un agente quiere antes
  de tocar un módulo y lo que el visor pinta como biblioteca.
- **La ingesta no es una tool del agente**: es un comando (`naeth code extract <repo>`) que corre griffe
  o TypeDoc y escribe por la API. Si se expone como tool, que sea para la capa de encima
  (`code_annotate`), nunca para escribir bloques a mano.

**Idioma y traducción** (su duda): los docstrings de Naeth y CENIT suman 62.380 caracteres (17.578 +
44.802), unos 15.000 tokens. Traducirlo todo con un modelo es barato y cabe en una pasada. La forma que
encaja con lo que ya hay: `doc` se guarda en el idioma del repo, `doc_translated` se genera al ingestar
y **viaja marcado como derivado**, igual que `excerpt` frente a `written` en `_resumen`
(`mcp_server.py:273`): quien lee sabe si está leyendo lo que él escribió o una traducción. El caso real
es GridWatch en inglés y todo lo demás en castellano; y si el objetivo son entrevistas en inglés, la
traducción al inglés de lo castellano es la que vale más. Decisión suya, no urge.

---

## 6. Cómo se sostiene en el tiempo: revisar y documentar como mecanismo

Lo que perdió no es saber documentar, es la costumbre, porque nadie la exigía. Dos palancas, una
mecánica y otra de revisión, y las dos existen ya a medias:

- **Mecánica: exigir Doc con el linter, en el hook que ya corre.** `py-lint.ps1` bloquea el turno con
  ruff sobre `F821,F811,E9` (`.claude/hooks/py-lint.ps1:47`). Las reglas `D1xx` de pydocstyle, que ruff
  trae de serie, comprueban **que exista** docstring en módulo, clase y función pública (D100 a D103). Es
  la misma idea que el hook explica en su cabecera: una verificación mecánica vive en un hook, no en
  "que el modelo se acuerde". Para JS y TS, `eslint-plugin-jsdoc` con `require-jsdoc`. Lo que el linter
  no puede exigir es que el docstring diga el porqué (fase 1 del cuaderno, §3): eso es lo siguiente.
- **De revisión: el `Stop` del cuaderno.** Al terminar un turno con código escrito, bloquear una vez y
  pedir la revisión con la guía de §2 delante: qué hace, por qué así, qué se descartó, qué se rompe.
  Sobrevive tal cual del plan del cuaderno (1.3), con un cambio: lo que se revisa es el docstring en el
  código, no una ficha aparte.

Y la guía de §2, en `CLAUDE.md` global, es lo que hace que yo escriba así desde el primer día (punto 1º).
Con la advertencia de la fase 1 del cuaderno: `CLAUDE.md` funciona con reglas concretas y falla con
vagas, y la de §2 es concreta porque sale de sus docstrings y no de adjetivos.

---

## 7. Lo que queda para la fase 2, y lo que decide él

**Para la fase 2, planificación, en este orden previsto:**

1. Probar tres cosas sobre `naeth/app` antes de diseñar: griffe con un docstring suyo tal cual y con una
   sección `Args:` añadida, para ver qué pinta cada generador (mkdocstrings, pdoc); ruff con `D1xx` sobre
   `naeth/app`, que ya está medido: **44 avisos sin contar tests** (27 en `mcp_server.py`, 11 en
   `oauth.py`, 5 en `core.py`, 1 en `worker.py`; 83 con los tests), todos D103 función pública sin
   docstring o D102 método, así que la regla se puede activar en `py-lint.ps1` el día que se decida y
   se sabe qué va a exigir; y un bloque de `search` embebido entero
   frente a embebido solo con su doc, para ver cuál encuentra mejor.
2. Cerrar la guía de estilo con él, sobre tres funciones reescritas: una de `oauth.py` (sin doc), una de
   `mcp_server.py` (doc en el decorador) y una ya buena de `core.py`.
3. Diseñar la tabla, la cola de embedding y las tres tools, y el orden de despliegue con el `classify`
   de CENIT primero.
4. Diseñar la vista del visor: repo, fichero, símbolo, doc renderizada y fragmento resaltado. Es un
   apartado, y el nombre da igual.
5. Documentar `naeth/app` al dedillo, empezando por `oauth.py` (1 de 30) y `mcp_server.py` (10 de 41),
   con la guía delante y él revisando. Es a la vez la primera ingesta real y el primer material de
   entrevista.
6. Después, `cenit_core`; después Yogin-API, que exige pasar de `//` a JSDoc; GridWatch entra ya
   documentado, en inglés.

**Lo que decidió él, a las 19:36 del 10/09**:

- **La guía de §2 se decidió viendo tres funciones reescritas**
  ([`../plan/biblioteca-codigo-tres-docstrings-2026-09-10.md`](../plan/biblioteca-codigo-tres-docstrings-2026-09-10.md))
  y el [espectro de estilos](../plan/biblioteca-codigo-espectro-estilos-2026-09-10.md) sobre
  `claim_batch` y una utilidad de Yogin. **Cerrada a las 20:26**: sintaxis Google; la narrativa en
  `Notes:` al final; `Example:` con doctest en utilidades puras; castellano con tildes corrigiendo lo
  viejo al tocarlo; cabecera de fichero en todos (`@fileoverview` en JS). Texto completo y ejemplos
  canónicos en [`../guia-documentacion.md`](../guia-documentacion.md); resumen operativo en el
  `CLAUDE.md` global.
- **Filtro de entrada: tiene Doc y más de 5 líneas.** Hoy, 131 símbolos Python. Lo importante es marca,
  no filtro.
- **Traducción al ingestar, en las dos direcciones, marcada como derivada.** `doc` en el idioma del repo,
  `doc_translated` generada en la pasada y señalada como traducción.
- **Los bloques entran en el grafo del visor.** Consecuencia para la fase 2: `/api/graph` lee hoy solo
  `memory_current` (`core.py:410-463`), así que con tabla propia el grafo tiene que unir las dos fuentes,
  y el color por primer segmento del path (`web/src/lib/graph.ts:22`) necesita que un bloque tenga
  proyecto (el repo). Son unos 300 nodos más hoy; el filtro de proyectos que ya existe permite apagarlos.

---

## 8. Sin verificar

- Que TypeDoc o el parser de JSDoc devuelvan para JS lo que griffe devuelve para Python. Se prueba en la
  fase 2, punto 1, sobre GridWatch, que ya tiene JSDoc.
- Que la `description` del decorador `@mcp.tool` valga como Doc a efectos del linter y de la
  biblioteca. Hoy es donde vive la documentación de las 41 tools y rutas, y un docstring vacío al lado
  sería duplicar; hay que decidir cuál de los dos es la fuente para esos casos.
- Que el worker se pueda generalizar a un `kind` nuevo de job sin tocar el sync. `job` es local por nodo
  (`schema.sql:107`), así que cada nodo embebería sus bloques, igual que hoy sus memorias.
