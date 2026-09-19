# Naeth

Sistema de memoria persistente personal, portable y local-first para LLMs y agentes, en claude.ai y
Claude Code sin atarse a un vendor.

**Es código en producción.** Desde el cutover del 17/07/2026 es el módulo `memory` de CENIT,
repartido entre este PC y el VPS `finally`. **Cuál de los dos manda cambia solo** (failover
local-preferente): para saber quién escribe ahora, mira `core/ops/failover-status.ps1` en CENIT, no
lo supongas. Lo que se rompa aquí se nota en todas las sesiones, así que cualquier cambio deja el
módulo funcionando o tiene rollback inmediato.

## Qué hay aquí

- `naeth/`, el código: Postgres+pgvector, API FastAPI, worker de embeddings, servidor MCP y visor.
- `naeth/web/`: visor v2 (Vite + Svelte 5 + TS + Tailwind v4). **Es lo que se sirve desde el
  22/08/2026**. **Ya no queda ninguna vista en stub**: el Grafo se entregó el 05/09/2026 con motor
  propio sobre canvas y d3-force (`lib/sim.ts`, `lib/pintor*.ts`, `views/graph/Lienzo.svelte`), y el
  mini grafo de la ficha usa el mismo lienzo y un mapa de posiciones compartido, para que el
  vecindario tenga la forma que tiene en el grafo global. Leer una nota **no monta el editor** desde
  el 04/09/2026: Crepe entra solo al pulsar Editar, y la lectura la pinta `lib/md.ts`. Estado,
  comandos, despliegue y trampas del editor en [`naeth/web/README.md`](naeth/web/README.md): míralo
  en vez de suponer hasta dónde llega. El visor v1 (`naeth/app/viewer/index.html`) se conserva sin
  ruta, como rollback (basta quitar `NAETH_VIEWER_DIR`) y como referencia.
- `pasos/`: histórico de diseño, Pasos 0-10. **Índice comentado en [`pasos/README.md`](pasos/README.md)**.
  Contiene material derogado; no lo apliques sin mirar antes ese índice.
- `docs/discovery/naeth.md`: qué es, arco del proyecto, convenciones y quirks. **Léelo antes de
  re-escanear el repo.**

## Comandos

**Pila viva:** `naeth/up.ps1` (o `up.sh`). Visor + API en `127.0.0.1:8800`; MCP en loopback sin auth
en `127.0.0.1:8801` (es por donde entra Claude Code, con `?s=code`).

**Tests del backend** (72 en `app/tests/`): el comando y sus cuatro trampas están en la skill
`naeth-tests`; léela antes de lanzarlos. Lo que no puede esperar a leerla: **NUNCA `docker compose
down`** para bajar el `db` del test. `--profile test down` baja la pila entera, api y viewer
incluidos (pasó el 22/08/2026). Se baja con `docker compose rm -sf db`.

**Tests del front** (`naeth/web/`), que tiene suite propia desde el 22/08/2026:

```
npm ci && npm test && npm run check && npm run build
```

Node no está en el PATH de una sesión nueva: vive en `F:\local\fnm\aliases\default` vía fnm. Ni
`check` ni `build` ejecutan la aplicación, así que lo que toque la UI se verifica además en el
navegador. Detalles y trampas en [`naeth/web/README.md`](naeth/web/README.md).

**No hay linter configurado** (`app/requirements-dev.txt` solo trae `pytest`). Para revisar un fichero
suelto sin instalar nada en el proyecto:

```
uvx ruff check --select F821,F811,F401,E9 <fichero.py>
```

## Reglas de trabajo

- **Citar evidencia** en cualquier afirmación no trivial (fichero, issue, sección) y marcar
  `⚠ sin verificar` lo que no esté confirmado. Aquí las suposiciones se propagan a sesiones futuras.
- **Nunca borrado físico**: el esquema es ADD-only. Editar es `memory_supersede`, retirar es
  `memory_tombstone`.
- **El repo es público** (`github.com/Enraxk/naeth`): ni un secreto en el código ni en el historial.
  La configuración viva va en `.env`, que está gitignorado.
- Al tocar el worker o la cola: `job` es una tabla **local por nodo**, no viaja en el sync. Una fila
  que llega a otro nodo sin su embedding necesita que alguien lo encole allí.
