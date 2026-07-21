# Paso 2 · Tres arquitecturas en papel

**Proyecto Naeth** — diseño de la arquitectura de composición sobre los 5 sistemas
de memoria persistente OSS analizados en `paso1-mapeo-interfaces.md`.

**Fecha**: 2026-05-29
**Alcance**: diseño documental. Tres arquitecturas candidatas, evaluación
cualitativa de cada una contra las 12 preguntas abiertas del Paso 1, y decisión
cualificada de cuál validar primero con un spike. **Sin código, sin pseudocódigo
de implementación, sin benchmarks** (eso es Paso 3+).
**Insumo**: `investigacion.md` (ranking) + `paso1-mapeo-interfaces.md` (integrabilidad).
**Reglas autoimpuestas**:
1. No re-rankear ni re-analizar integrabilidad (está en los pasos previos).
2. Cada decisión de diseño cita la evidencia del Paso 1 que la respalda.
3. Marcar `⚠ a validar en spike` lo que no se puede decidir desde papel.
4. No elegir backends finales de forma irreversible: el Paso 2 acota, el spike confirma.
5. Diagramas conceptuales sí; implementación no.

---

## 1. Resumen ejecutivo

Las tres topologías que el Paso 1 dejó nombradas responden a tres preguntas
distintas sobre **dónde vive la verdad** y **quién paga el coste**:

| Arquitectura | Naeth es… | Store-of-record | Coste dominante | Riesgo principal |
|---|---|---|---|---|
| **A · Federación lateral** | Router scatter-gather sobre pares | Distribuido (cada backend manda en su slice) | Latencia de lectura + N embeddings | Consistencia de escritura y latencia p95 |
| **B · Pipeline en cascada** | Hot tier síncrono + bus async a enrichment | El hot tier (Markdown soberano) | Complejidad operacional del bus | Desfase del tier de enriquecimiento |
| **C · Spec con adaptadores** | Dueña del contrato UMAS v2 + drivers | Naeth (canónico) o el adaptador activo | Ingeniería de la spec + N adaptadores | Aplanar el valor de los backends ricos |

**Adelanto de la decisión** (detalle en §4): ninguna arquitectura pura gana en
abstracto, pero la que **de-riesga primero lo que no sabemos** es **B**, porque
mete un *hot tier* rápido en el camino crítico (ataca la pregunta 1, latencia, la
única marcada como "solo medible en spike") y fija un **único source of truth**
que simplifica las preguntas 4 y 8. Además, el *event bus* que B obliga a
construir es necesario en las tres arquitecturas (es el hueco 4.2.1 del Paso 1:
ningún backend emite webhooks), así que construirlo primero no es trabajo
desperdiciado. El spike recomendado es un subconjunto mínimo, **no los 5
sistemas**.

---

## 2. Las tres arquitecturas

### 2.1 Arquitectura A · Federación lateral (router scatter-gather)

**Concepto.** Naeth es un *router* sin storage propio. Los backends son pares; cada
uno es dueño de su porción de memoria. La escritura hace *fan-out*; la lectura
hace *scatter-gather* en paralelo y Naeth fusiona y re-rankea.

```
                         ┌──────────────────────────────┐
   claude.ai  ──MCP──▶   │            NAETH             │
   Claude Code ─MCP──▶   │  (1 MCP server proxy)        │
                         │  write fan-out / read merge  │
                         └───┬───────┬───────┬───────┬──┘
                  write+read │       │       │       │
                ┌───────────┘   ┌───┘   ┌───┘   ┌───┘
                ▼               ▼       ▼       ▼
            MM-S            Hindsight  Cognee  Basic Memory  (Graphiti…)
         (rápido)         (TEMPR)    (KG)    (Markdown)
```

- **Store-of-record**: distribuido. No hay una verdad única; cada backend manda
  en lo suyo (MM-S en sus chunks, Graphiti en lo temporal, Basic Memory en los MD).
- **Escritura**: `fan-out` a los backends que la *policy* indique. Como ninguno
  acepta embedding precomputado (Paso 1 §4.2.2, pregunta 5), cada backend regenera
  → **N embeddings duplicados**. Si dos o más son LLM-heavy (Hindsight/Cognee/
  Graphiti, §4.1.4), cada `write` dispara varias llamadas LLM en paralelo.
- **Lectura**: `recall` consulta en paralelo, cada backend devuelve su JSON, Naeth
  fusiona con RRF (idea robable de Hindsight #1) y trunca. El reranker vive en Naeth.
- **Interfaz al cliente**: 1 MCP server proxy (modelo A de la pregunta 11), para
  no exponer las 91 tools (Paso 1 §3).
- **Backends que encajan**: todos, pero su valor rico se pierde en parte porque la
  fusión los aplana a "lista de resultados".

**Pros**
- Aprovecha lo mejor de cada backend simultáneamente sin elegir.
- Degradación *graceful* natural: si un backend cae, hay resultado parcial
  (responde directo a la pregunta 3).
- Sin lock-in de un único proveedor; cada backend es reemplazable en caliente.

**Contras**
- **Latencia = el más lento + el reranker** (pregunta 1). Un backend LLM-heavy en
  el camino crítico de lectura dispara el p95. `⚠ a validar en spike`.
- **Consistencia de escritura sin resolver** (pregunta 4): si el `fan-out` falla
  en 1 de N, queda estado parcial sin source-of-truth que reconcilie.
- **N embeddings + N facturas LLM** por escritura (preguntas 5 y 10).
- **Entity resolution cross-system** queda totalmente a cargo de Naeth y es el
  hueco 4.2.3 (pregunta 6): la misma entidad aparece N veces sin enlazar.
- **Respuesta combinada puede superar 1MB MCP** (pregunta 2) con 4-5 backends.

---

### 2.2 Arquitectura B · Pipeline en cascada (tiers caliente → frío)

**Concepto.** Los backends se ordenan por **velocidad y coste**, no como pares. Un
*hot tier* síncrono, LLM-light, absorbe la escritura y sirve el `recall` rápido.
Un *enrichment tier* LLM-heavy consume del hot tier **en segundo plano** y añade
grafo / temporal / consolidación. Naeth corre el bus que conecta ambos, porque
ningún backend emite eventos (hueco 4.2.1).

```
                      ┌───────────────────────────────────────┐
  claude.ai ─MCP─▶    │                 NAETH                 │
  Claude Code─MCP▶    │  1 MCP proxy · write síncrono al hot  │
                      └───┬─────────────────────────────▲─────┘
            write+recall  │                             │ recall escalado
                          ▼                             │ (si hot no basta)
                  ┌───────────────┐                     │
                  │  HOT TIER     │ ── source of truth ─┘
                  │  Basic Memory │   (Markdown en disco, soberano)
                  │  o MM-S       │
                  └──────┬────────┘
                         │ event bus de Naeth (async, propio)
                         ▼
                  ┌───────────────────────────────┐
                  │  ENRICHMENT TIER (async)       │
                  │  Graphiti (temporal)  ó        │  ← uno, no ambos (Q9)
                  │  Cognee (KG)          ó        │
                  │  Hindsight (TEMPR)             │
                  └───────────────────────────────┘
                  proyección/índice derivado, regenerable
```

- **Store-of-record**: el **hot tier**. Recomendación de papel: Basic Memory, cuyo
  storage *es* Markdown en disco (Paso 1 §2.4, "el más buen ciudadano") → la verdad
  es legible, versionable y regenerable. El enrichment tier es **proyección
  derivada**: si se corrompe o el upstream pivota, se reconstruye releyendo los MD.
  - Nota de licencia (Paso 1 §4.4): Basic Memory es **AGPL-3.0**. Si Naeth solo
    **lee/escribe los archivos Markdown** que Basic Memory materializa y no enlaza
    su código en runtime, la AGPL no se propaga. Mantener esa frontera es decisión
    de diseño, no accidente. `⚠ a validar en spike` que el watcher de Basic Memory
    reindexa correctamente lo que Naeth deja caer en disco (§2.4 lo documenta).
- **Escritura**: síncrona y barata al hot tier (sin LLM en el camino crítico,
  §4.1.4); Naeth encola el evento; un *worker* propaga al enrichment tier cuando
  toca. El coste LLM y los N embeddings (pregunta 5) se **difieren** fuera del
  camino del usuario y solo afectan a **un** backend de enriquecimiento, no a N.
- **Lectura**: primero el hot tier (rápido, acota la pregunta 1). Si la consulta
  necesita razonamiento temporal o grafo, Naeth **escala** al enrichment tier. La
  mayoría de los `recall` se resuelven en el tier rápido.
- **Backends que encajan**: hot = Basic Memory o MM-S (LLM-light). Enrichment =
  **uno** de Graphiti/Cognee/Hindsight (la pregunta 9 avisa de que Cognee y
  Graphiti duplican entity-extraction; no usar los dos).

**Pros**
- **Latencia de recall acotada** por diseño (pregunta 1): el camino crítico no
  toca backends LLM-heavy.
- **Source of truth único y claro** (preguntas 4 y 8): partial write tolerable
  porque el enrichment es derivado regenerable; no hace falta saga ni rollback
  distribuido.
- **FIFO controlable** en el hot tier (pregunta 12): el orden se fija al escribir
  en un único punto.
- El **event bus** que obliga a construir es necesario en las tres arquitecturas
  → inversión reutilizable, no a fondo perdido.
- Coste LLM y embeddings sobre **un** backend, diferidos (preguntas 5, 10).

**Contras**
- **El enrichment va por detrás** (eventual): un `recall` que necesite el grafo
  recién escrito puede no encontrarlo aún. `⚠ a validar en spike`: ¿cuánto desfase
  es tolerable?
- Naeth debe **construir y operar** el bus + worker (complejidad que A y C-puras
  no tienen tan en primer plano).
- Reprocesar al enrichment reintroduce coste LLM y embeddings (pregunta 5), aunque
  diferido y acotado a un backend.

---

### 2.3 Arquitectura C · Spec con adaptadores (UMAS v2 + driver ABC)

**Concepto.** Naeth define un **contrato de memoria** canónico (UMAS v2) y cada
backend vive detrás de un **adaptador** que implementa una interfaz común tipo
`MemoryStorage` ABC (idea robable de MM-S #2; el patrón `factory.py` que selecciona
backend por configuración ya existe upstream). El contrato fija qué es una memoria
(el patrón candidato del Paso 1 §4.1.2: triplet `entity/predicate/value` + metadata
temporal + identidad de cliente) y un **export/import lossless** que hoy nadie
ofrece (hueco 4.2.4).

```
   claude.ai ─MCP─▶ ┌─────────────────────────────────────────┐
   Claude Code─MCP▶ │                 NAETH                   │
                    │  UMAS v2 (contrato canónico de memoria) │
                    │  + storage canónico propio (opcional)   │
                    └──┬──────────┬──────────┬──────────┬─────┘
                       │ adapter  │ adapter  │ adapter  │ adapter
                       ▼          ▼          ▼          ▼
                     MM-S     Basic Mem.   Cognee    Graphiti
            (cada adaptador traduce UMAS v2 ⇄ modelo nativo del backend)
```

- **Dos sub-variantes**:
  - **C1 · Un backend activo, conmutable** (como MM-S `factory.py`): no hay
    federación. Eliges un backend; Naeth te da **portabilidad** para cambiar sin
    perder datos gracias al export común UMAS v2. Resuelve el riesgo comercial /
    bus-factor (Paso 1 §4.4) de raíz.
  - **C2 · Storage canónico propio + write-through**: Naeth posee la verdad y
    proyecta a backends como índices especializados. Resuelve el embedding canónico
    (pregunta 5) porque Naeth lo computa una vez sobre su propio store.
- **Store-of-record**: Naeth (C2) o el adaptador activo (C1).
- **Interfaz al cliente**: 1 MCP server con tools en términos de UMAS v2
  (modelo A de la pregunta 11). Contrato de memoria explícito (pregunta 7).

**Pros**
- **Portabilidad real**: cambiar de backend sin perder datos (mitiga §4.4
  directamente: pivotadas comerciales, bus factor 1 de MM-S).
- **Contrato de memoria explícito y versionado** (pregunta 7); UMAS v2 puede ser
  el roundtrip lossless que ningún sistema tiene (hueco 4.2.4).
- 1 MCP server limpio (pregunta 11); embedding canónico resuelto en C2 (pregunta 5).

**Contras**
- **Mayor coste de ingeniería**: definir y mantener UMAS v2 + N adaptadores, cada
  uno persiguiendo upstreams que releasan cada 3 días (MM-S) a semanal (Paso 1 §4.4).
- **Los backends ricos resisten ser drivers** (Paso 1 §2.2, §2.3, §2.5): el valor
  de Hindsight/Cognee/Graphiti está en su *pipeline cerrado*, no en CRUD. Reducir
  Graphiti a `put/get` por una ABC simple **tira su bi-temporalidad**; reducir
  Hindsight tira su stack TEMPR. El mínimo común denominador **aplana el valor**.
- Ninguno acepta embedding precomputado (pregunta 5): C2 escribiendo embeddings
  canónicos a los backends requiere **bypassear sus APIs** (escribir a su storage
  directo), lo que es frágil ante cada release. `⚠ a validar en spike`.

---

## 3. Evaluación contra las 12 preguntas abiertas

Leyenda: ✅ la arquitectura la responde bien · ⚠ la deja parcialmente abierta o
depende de spike · ❌ la agrava.

| # | Pregunta (Paso 1 §5) | A · Federación | B · Cascada | C · Spec+adapt. |
|---|---|:---:|:---:|:---:|
| 1 | Latencia compuesta p50/p95 | ❌ máx de los lentos | ✅ hot tier acota | ⚠ depende sub-variante |
| 2 | Tamaño respuesta MCP (1MB) | ❌ suma de N JSON | ✅ una fuente primaria | ✅ formato canónico |
| 3 | Fallo de un backend | ✅ parcial natural | ✅ enrichment es opcional | ⚠ C1 sin red; C2 sí |
| 4 | SSOT vs eventual | ❌ sin reconciliador | ✅ hot = verdad | ✅ canónico = verdad |
| 5 | Embedding canónico | ❌ N duplicados | ⚠ 1 diferido | ✅ C2 lo posee (si bypass) |
| 6 | Identidad cross-system | ❌ todo a Naeth | ⚠ 1 enrichment, menos superficie | ✅ UMAS v2 la define |
| 7 | Contrato de "memoria" | ⚠ mínimo común implícito | ⚠ el del hot tier | ✅ explícito (es el punto) |
| 8 | ¿Router o storage propio? | router puro | hot tier propio | C2 storage / C1 router |
| 9 | Solapamiento Cognee/Graphiti | ❌ invita a usar ambos | ✅ obliga a elegir uno | ⚠ adaptador por cada uno |
| 10 | Gestión LLM provider | ❌ N facturas | ✅ 1 (el enrichment) | ⚠ una por adaptador activo |
| 11 | 1 MCP proxy vs N servers | ✅ proxy | ✅ proxy | ✅ proxy |
| 12 | Orden de escrituras (FIFO) | ❌ N destinos sin orden | ✅ 1 punto de entrada | ✅ 1 punto de entrada |

**Lectura de la tabla.** A maximiza cobertura pero **agrava casi todas las
preguntas duras** (latencia, consistencia, coste, identidad). C resuelve las
preguntas de *contrato y portabilidad* a cambio del mayor coste de ingeniería y
del riesgo de aplanar el valor de los backends ricos. B es la que más casillas
verdes acumula en las preguntas marcadas como críticas o "solo medibles en spike"
(1, 4, 8, 12), y deja las suyas abiertas (3→✅, 5/6 diferidas) en terreno donde el
fallo no es catastrófico (el enrichment es derivado regenerable).

---

## 4. Decisión cualificada: qué validar primero con spike

**No se construye la arquitectura final en el spike. Se valida la suposición que,
si es falsa, invalida todo lo demás.** Esa suposición es la **pregunta 1**: ¿se
puede componer memoria con latencia aceptable (<2s) para un chat client? Es la
única que el Paso 1 marcó explícitamente como "solo medible en spike", y las tres
arquitecturas dependen de su respuesta.

**Spike recomendado: la espina dorsal de la Arquitectura B, con el subconjunto
mínimo.** No los 5 sistemas.

- **Naeth** como **1 MCP server proxy** (resuelve la pregunta 11 sin discusión).
- **Hot tier = Basic Memory** (Markdown en disco como source of truth soberano,
  AGPL aislada por la frontera "solo leo/escribo sus MD"). Escritura síncrona.
- **Event bus propio mínimo** de Naeth (el hueco 4.2.1; necesario en A, B y C).
- **Enrichment tier = exactamente uno**, async. Candidato por defecto: **Graphiti
  con backend Kuzu embebido** (Paso 1 §2.5: Kuzu es la opción menos invasiva para
  uso personal) si lo que se quiere validar es razonamiento temporal; alternativa
  **Cognee** si lo prioritario es KG emergente. No ambos (pregunta 9).

**Qué mide el spike (y qué pregunta cierra cada medición)**:
1. p50/p95 de `recall` solo-hot-tier y con escalado al enrichment → **pregunta 1**.
2. Tamaño de la respuesta MCP combinada en consultas realistas → **pregunta 2**.
3. Comportamiento ante caída del enrichment tier (¿el recall hot sigue?) →
   **pregunta 3**.
4. Desfase del enrichment async tras una escritura (¿cuándo aparece el grafo?) →
   abre la métrica que decide si el modelo eventual de B es tolerable.
5. Coste real de una escritura enriquecida (llamadas LLM, embeddings) →
   **preguntas 5 y 10**, ya acotadas a un backend.

**Por qué B y no A ni C para el primer spike**:
- **No A**: pondría un backend LLM-heavy en el camino crítico de lectura desde el
  minuto cero, contaminando la medición de latencia con el peor caso antes de
  saber si el caso bueno (hot tier) siquiera es aceptable.
- **No C**: el mayor coste de C es definir UMAS v2 y los adaptadores; gastarlo
  antes de saber si la composición es viable en latencia es invertir en el contrato
  de algo que quizá no compense componer. C se diseña **después** de que el spike
  confirme viabilidad; y nada impide que el hot tier de B adopte UMAS v2 más tarde
  (B y C son **componibles**, no excluyentes).

**Camino evolutivo si el spike sale bien**: B-mínima → añadir UMAS v2 al hot tier
(empieza C sobre B) → considerar federación lateral (A) solo para *lecturas* sobre
backends ya poblados, nunca para escrituras. Es decir: el destino probable es un
**híbrido B+C** con A como modo de lectura opcional, no una de las tres puras.

---

## 5. Preguntas que el Paso 2 deja para el Paso 3 (spike)

Más allá de las 12 del Paso 1, el diseño en papel destapa estas decisiones que
solo el spike puede cerrar:

1. **¿El event bus es in-process o un broker real?** Para uso personal/local-first,
   ¿basta una cola en SQLite/fichero, o hace falta algo tipo Redis Streams? El
   Paso 1 no lo decide.
2. **¿El watcher de Basic Memory aguanta que Naeth escriba los MD por debajo?**
   El §2.4 dice que reindexa archivos que aparecen, pero la interacción con
   escrituras concurrentes de Naeth + humano en Obsidian (last-write-wins, sin
   locks) es `⚠ a validar`.
3. **¿Graphiti-Kuzu o Cognee como primer enrichment?** Depende de si el caso de
   uso real de Eneko pesa más en *temporal* ("¿qué creía la semana pasada?") o en
   *KG* ("¿qué se relaciona con qué?").
4. **¿Cuál es el formato de evento del bus?** Antesala de UMAS v2; conviene que el
   evento ya hable el contrato canónico aunque el hot tier no lo exija.
5. **Identidad de cliente** (`claude.ai` vs `claude-code` vs humano-Obsidian) como
   dimensión de primera clase desde el evento (hueco 4.2.6).

---

## 6. Lo que NO está en este documento (intencional)

- Pseudocódigo o implementación del proxy, el bus o los adaptadores (Paso 3+).
- Benchmarks o cifras de latencia/coste (se generan en el spike, Paso 3+).
- Elección irreversible de backends (el spike confirma; el papel solo acota).
- Re-análisis de integrabilidad o re-ranking (Pasos 0 y 1).
- Diseño detallado de UMAS v2 (se aborda si el spike valida la composición).

---

**Fin del Paso 2.** Próximo paso: spike de la espina dorsal de la Arquitectura B
(Naeth proxy MCP + Basic Memory hot tier + 1 enrichment async), instrumentado para
medir latencia (p50/p95), tamaño de respuesta MCP, degradación ante fallo y desfase
del enrichment. Objetivo: cerrar la pregunta 1 y decidir el híbrido B+C definitivo.
