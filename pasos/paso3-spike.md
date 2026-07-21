# Paso 3 · Spike de la Arquitectura B (LLM-light)

**Proyecto Naeth** — validación empírica de la composición decidida en
`paso2-arquitecturas.md`, reconfigurada tras la restricción de hardware del VPS.

**Fecha**: 2026-05-29
**Alcance**: spike ejecutable. Montar el subconjunto mínimo, **medir** y cerrar la
pregunta 1 (latencia) y las que dependan de ella. Banco de pruebas en **Windows**;
el despliegue real irá a un **VPS Ubuntu**.
**Insumo**: `paso2-arquitecturas.md` (decisión: espina dorsal de B) + decisiones de
diseño tomadas en sesión (ver §1).
**Reglas autoimpuestas**:
1. Medir, no opinar: cada criterio de éxito es un número o un sí/no observable.
2. Subconjunto mínimo. Nada que no sirva para responder una pregunta abierta.
3. Honestidad de entorno: marcar qué se valida en Windows y qué queda para el VPS.
4. Sin LLM en ninguna parte del camino (decisión de diseño, ver §1).

---

## 1. Decisiones que reconfiguran el Paso 2

El Paso 2 eligió spikear la espina dorsal de B con Basic Memory (hot tier) + **un
enrichment async**, y dejó como candidato por defecto **Graphiti+Kuzu** para
razonamiento temporal. Cuatro decisiones de sesión lo ajustan:

1. **Hardware del VPS**: GTX 1660 (4 GB VRAM), Ryzen 5 5500, 64 GB RAM. 4 GB de VRAM
   descartan inferencia LLM local de calidad (solo cabe un 3-4B Q4, extracción de
   entidades pobre).
2. **Sin dependencia de LLM**: se opta por **temporal ligero local-puro**. Se cae
   **Graphiti** (es LLM-heavy en escritura, Paso 1 §4.1.4). Naeth queda enteramente
   en el lado **LLM-light**: cero LLM, cero API, cero coste, todo en CPU.
3. **La composición se mantiene** cambiando el inquilino del enrichment: en vez de
   Graphiti, el segundo tier es **mcp-memory-service** (LLM-light), que aporta lo que
   Basic Memory tiene más débil (hybrid search BM25+vector con RRF, dedup semántico,
   parser NL temporal, consolidación), con embeddings locales ONNX/sentence-transformers.
4. **Forma de composición**: **B · cascada** (no A federación, no Basic Memory solo).
   Source of truth único = los `.md` de Basic Memory; mcp-memory-service es índice
   derivado regenerable.

> Nota: al ser ahora dos sistemas LLM-light locales, la Arquitectura A (federación)
> vuelve a ser competitiva (sus contras en el Paso 2 venían del coste LLM-heavy). El
> spike mide B; los datos permitirán decidir si A merecería una segunda prueba.

---

## 2. Arquitectura del spike

```
                      ┌───────────────────────────────────────┐
   harness  ─────────▶│              NAETH (proxy)            │
   (simula cliente    │  write síncrono → hot · recall        │
    MCP claude.ai /    └───┬─────────────────────────────▲─────┘
    Claude Code)          │                             │ recall escalado
              write+recall │                             │ (si hot no basta)
                           ▼                             │
                   ┌───────────────┐                     │
                   │  HOT TIER     │ ── source of truth ─┘
                   │  Basic Memory │   .md + frontmatter (temporal)
                   └──────┬────────┘   búsqueda híbrida local (fastembed)
                          │ event bus SQLite (cola, async)
                          ▼
                   ┌──────────────────────────────┐
                   │  ENRICHMENT (async, sin LLM)  │
                   │  mcp-memory-service           │
                   │  hybrid RRF · dedup · NL temp │
                   └──────────────────────────────┘
                   índice derivado, regenerable desde los .md
```

Para el spike, el **proxy** se implementa como un harness Python in-process (no hace
falta el transporte MCP real para medir la latencia de composición; el overhead MCP
se anota aparte). Lo que se mide es el coste de la **composición**, no del transporte.

---

## 3. Componentes y versiones

| Pieza | Qué | Notas de entorno |
|---|---|---|
| Python | 3.12 vía `uv` (el sistema tiene 3.11; Basic Memory exige ≥3.12) | `uv python install 3.12` |
| Basic Memory | hot tier · storage Markdown + SQLite index + fastembed | `uv tool install basic-memory` |
| mcp-memory-service | enrichment · SQLite-vec + ONNX | imagen/instalación `:quality-cpu` (sin PyTorch) si es posible |
| Event bus | tabla SQLite como cola FIFO + worker poll | sin broker externo (decisión local-first) |
| Embeddings | locales: fastembed (Basic Memory) / sentence-transformers-ONNX (MM-S) | descarga de modelos la primera vez |
| Instrumentación | `time.perf_counter`, percentiles, tamaños de payload | script propio |

**Windows-test vs Ubuntu-prod**: en Windows pueden aparecer fricciones con deps
nativas (`sqlite-vec`, `onnxruntime`). Lo que no monte limpio en Windows se documenta
y se difiere al VPS Ubuntu, donde estas deps son de primera clase.

---

## 4. Fases de ejecución

- **Fase 0 · Setup**: entorno `uv` con Python 3.12; instalar Basic Memory y
  mcp-memory-service; verificar que arrancan y que sus embeddings locales cargan.
- **Fase 1 · Hot tier solo** (no necesita el enrichment): poblar Basic Memory con un
  corpus sintético de notas con frontmatter temporal; medir recall p50/p95 solo-hot;
  medir tamaño de respuesta; verificar temporal por frontmatter.
- **Fase 2 · Bus + enrichment**: cola SQLite; worker que propaga cada escritura a
  mcp-memory-service; medir desfase del enrichment; medir recall escalado (hot→MM-S).
- **Fase 3 · Resiliencia**: matar mcp-memory-service y confirmar que el recall hot
  sigue respondiendo (degradación graceful).

---

## 5. Qué se mide y criterios

| Métrica | Qué cierra | Criterio de éxito | Criterio de fracaso |
|---|---|---|---|
| **M1** recall p50/p95 solo-hot | pregunta 1 (latencia) | p95 < 2 s | p95 ≥ 2 s con corpus pequeño |
| **M1b** recall p50/p95 escalado | pregunta 1 | p95 < 2 s | p95 ≥ 2 s |
| **M2** tamaño respuesta | pregunta 2 (1 MB MCP) | < 256 KB en consultas típicas | se acerca a 1 MB |
| **M3** caída del enrichment | pregunta 3 (graceful) | recall hot sigue OK | recall falla si cae MM-S |
| **M4** desfase enrichment | tolerancia del modelo eventual | el dato aparece en MM-S en pocos s | minutos / no aparece |
| **M5** coste LLM | preguntas 5, 10 | **N/A** — no hay LLM (cero coste) | — |

M5 queda cerrada por diseño: sin LLM, no hay coste de inferencia ni facturas; los
embeddings son locales. Es el dividendo de la decisión de §1.

---

## 6. Lo que el spike NO cubre (intencional)

- Transporte MCP real (claude.ai / Claude Code conectados). Se mide composición, no
  transporte; el overhead MCP se anota como pendiente del montaje real en el VPS.
- UMAS v2 / contrato canónico (es Paso 4, si el spike valida la composición).
- Concurrencia humano-Obsidian + Naeth sobre los mismos `.md` (riesgo conocido del
  Paso 2 §5.2; se valida en el VPS con uso real).
- Bi-temporalidad de entidades (descartada con Graphiti; el temporal aquí es por
  frontmatter + parser NL, sin grafo).

---

**Inicio del Paso 3.** Siguiente: montar Fase 0 y empezar a medir.
