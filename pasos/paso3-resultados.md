# Paso 3 · Resultados del spike (Fase A)

> Mediciones reales en el banco de pruebas **Windows** (Python 3.12, CPU; sin GPU,
> sin Docker, sin LLM). Corpus sintético de 200 notas, 20 repeticiones del query
> set (200 recalls por métrica). Código en `spike/`. Fecha: 2026-05-29.

## Qué se midió de verdad

**Hot tier real**: Basic Memory 0.21.5 in-process (event loop persistente, no el
`asyncio.run` por llamada del CLI — para no inflar la latencia con montaje/derribo
del motor DB). Búsqueda FTS (texto) y semántica (embeddings locales 384-dim,
sentence-transformers/ONNX en CPU). **Enrichment**: aún el adaptador de referencia
(placeholder); el cableado real de mcp-memory-service es la Fase B.

## Tabla de resultados

| Métrica | Pregunta que cierra | Texto (FTS) | Semántico (CPU) | Criterio | Veredicto |
|---|---|---|---|---|---|
| **M1** recall p50 | 1 (latencia) | 94.2 ms | 134.8 ms | p95 < 2 s | ✅ |
| **M1** recall p95 | 1 | 142.3 ms | 176.3 ms | p95 < 2 s | ✅ holgado |
| **M1** recall p99 | 1 | 219.8 ms | 232.1 ms | — | ✅ |
| **M1** recall max | 1 | 280.5 ms | 364.0 ms | — | ✅ |
| **M2** payload máx | 2 (1 MB MCP) | 3.4 KB | 5.4 KB | < 256 KB | ✅ ~300× margen |
| **M3** hot survives enrichment down | 3 (graceful) | ✅ 5 hits | ✅ 5 hits | sigue OK | ✅ |
| **M4** desfase bus (con enrich. referencia) | tolerancia eventual | drena, p50 52 ms | drena, p50 52 ms | drena en pocos s | ✅ (placeholder) |
| **M5** coste LLM | 5, 10 | N/A | N/A | sin LLM = 0 | ✅ por diseño |
| write p50 (no crítico) | — | 795 ms | 741 ms | — | — |

## Lectura

1. **Pregunta 1 (la que invalidaba todo) está respondida y holgada.** El recall del
   hot tier es ~95 ms (texto) / ~135 ms (semántico) en p50, con p99 < 235 ms. Un
   orden de magnitud por debajo del umbral de 2 s de un chat client. La Arquitectura
   B en cascada es viable en latencia.
2. **El semántico en CPU es viable sin GPU.** Solo ~40 ms más que el texto. Esto es
   directamente relevante para el VPS (GTX 1660 4 GB): no hace falta GPU para el
   recall semántico local; el embedding de la query (384-dim) corre en CPU en
   milisegundos. (El modelo se carga una vez en el warm-up, excluido de la medida.)
3. **El tamaño de respuesta no es un problema** a esta escala: KB, no MB. La
   pregunta 2 (límite 1 MB MCP) no aprieta salvo en consultas con k enorme.
4. **La escritura es el coste real** (~750-800 ms p50), por el pipeline completo de
   Basic Memory (fichero + índice FTS + fingerprint vectorial + roundtrip ASGI
   in-process en Windows). Va por el camino **no crítico** (escritura síncrona al
   hot tier, enrichment async), así que no toca la pregunta 1. En el VPS Ubuntu
   (filesystem nativo) probablemente baje.
5. **Resiliencia confirmada**: con el enrichment caído, el recall del hot tier sigue
   respondiendo — la degradación graceful de B es real (pregunta 3).

## Caveats honestos

- **Escala pequeña**: 200 notas. La latencia de recall crece con el corpus; medir
  con 10k-100k notas antes de dar la cifra por definitiva.
- **Enrichment aún placeholder**: M1b y M4 con backend real (mcp-memory-service)
  quedan para la Fase B. M4 aquí mide solo la mecánica del bus, no el coste de
  ingest real.
- **Sin transporte MCP**: se mide la composición in-process, no claude.ai/Claude
  Code conectados por MCP. El overhead del transporte se mide en el montaje del VPS.
- **Windows vs Ubuntu**: la escritura podría comportarse distinto en el VPS
  (filesystem, deps nativas de primera clase).

## Estado de las fases

- **Fase 0 (setup)**: ✅ Python 3.12 + Basic Memory instalados y arrancando en Windows.
- **Fase 1 (hot tier solo)**: ✅ medida — M1/M2/M3 reales, texto y semántico.
- **Fase 2 (bus + enrichment real)**: ⏳ pendiente — instalar y cablear
  mcp-memory-service (Fase B); decidir si se hace en Windows o directo en el VPS.
- **Fase 3 (resiliencia)**: ✅ M3 confirmada.

## Fase de escalado · ¿dónde está el techo?

Medir el escalado *vía Basic Memory* chocó con que **poblar es caro** (parseo de
markdown + grafo de entidades + embeddings en CPU). Eso reveló el método correcto:
separar el eje **recall** del eje **ingest** y medir cada motor aislado.

### Recall (motores aislados: SQLite FTS5 y sqlite-vec/vec0)

Inserción masiva sintética (sin embeddings ni markdown), latencia de consulta:

| Notas | FTS5 texto p50/p95 | vec0 semántico p50/p95 |
|---|---|---|
| 1.000 | 0.44 / 0.85 ms | 0.64 / 1.5 ms |
| 10.000 | 4.2 / 6.4 ms | 5.1 / 8.6 ms |
| 100.000 | 47 / 59 ms | 44 / 49 ms |
| 500.000 | — | 208 / 222 ms |
| 1.000.000 | 583 / 728 ms | ~400 ms (extrapolado) |

**El recall NO es el techo.** Sub-segundo hasta 1M notas en CPU; a escala personal
(≤50k) está en <50 ms. Crece ~linealmente (ambos motores escanean), pero desde una
base tan baja que el margen es enorme. Basic Memory añade un overhead ~constante
(~90 ms de roundtrip ASGI, medido en n=200) sobre estas cifras.

### Ingest (throughput de embeddings en CPU · el techo real)

fastembed `bge-small-en-v1.5` (384-dim), modelo que usa Basic Memory, en esta CPU:

| batch_size | textos/seg | 100k notas |
|---|---|---|
| 2 (default BM) | 109 | ~15 min |
| 32 | 82 | ~20 min |
| 256 | 74 | ~22 min |

**Corrección honesta**: anteriormente afirmé que `batch_size: 2` era un mal default;
la medición lo desmiente — es el más rápido aquí (onnxruntime ya paraleliza intra-batch;
batches grandes solo añaden presión de memoria). Me equivoqué.

**El único techo real es generar embeddings: ~100 notas/seg en CPU.** Insertar y
consultar es trivial; inferir el vector es lo caro. (En el VPS Ryzen 5 5500, 6c/12t,
podría subir tuneando los threads de onnxruntime.)

### Qué significa para Naeth

- **En uso personal vivo no hay techo práctico**: añades notas de una en una
  (instantáneo) y el recall es <50 ms hasta decenas de miles de notas.
- Los ~100/s **solo** muerden en un **backfill masivo** (migrar un corpus grande de
  golpe). Y eso es justo lo que la **Arquitectura B** empuja al bus async, fuera del
  camino del usuario: el coste lento nunca se ve en el recall. **El escalado valida B.**

## Veredicto de la Fase A

La suposición crítica del Paso 2 —que componer memoria se puede hacer con latencia
aceptable— **se sostiene con margen amplio**, y además **sin GPU y sin LLM**. La
Arquitectura B en cascada LLM-light es viable. Procede: cablear el enrichment real
(Fase B) y, después, validar a escala mayor y con transporte MCP en el VPS.
