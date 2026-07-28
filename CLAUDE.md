# Naeth

Sistema de memoria persistente personal, portable y local-first para LLMs y agentes, en claude.ai y
Claude Code sin atarse a un vendor.

**Es código en producción.** Desde el cutover del 17/07/2026 es el módulo `memory` de CENIT,
repartido entre este PC y el VPS `finally`. **Cuál de los dos manda cambia solo** (failover
local-preferente): para saber quién escribe ahora, mira `core/ops/failover-status.ps1` en CENIT — no
lo supongas. Lo que se rompa aquí se nota en todas las sesiones, así que cualquier cambio deja el
módulo funcionando o tiene rollback inmediato.

## Qué hay aquí

- `naeth/` — el código: Postgres+pgvector, API FastAPI, worker de embeddings, servidor MCP y visor.
- `naeth/web/` — visor v2 (Vite + Svelte 5 + TS + Tailwind v4), **en construcción**. Estado, comandos
  y estructura en [`naeth/web/README.md`](naeth/web/README.md): míralo en vez de suponer hasta dónde
  llega. El visor v1 (`naeth/app/viewer/index.html`) sigue vivo como especificación de referencia.
- `pasos/` — histórico de diseño, Pasos 0-10. **Índice comentado en [`pasos/README.md`](pasos/README.md)**.
  Contiene material derogado; no lo apliques sin mirar antes ese índice.
- `docs/discovery/naeth.md` — qué es, arco del proyecto, convenciones y quirks. **Léelo antes de
  re-escanear el repo.**

## Comandos

**Pila viva:** `naeth/up.ps1` (o `up.sh`). Visor + API en `127.0.0.1:8800`; MCP en loopback sin auth
en `127.0.0.1:8801` (es por donde entra Claude Code, con `?s=code`).

**Tests** — 23 en `app/tests/`:

```
docker compose --profile test run --rm test
```

⚠ Tres cosas que hay que saber **antes** de lanzarlos, y que cuestan caro descubrir:

1. **Levanta el servicio `db`, que está retirado a propósito.** `docker-compose.yml:14-16` lo
   documenta: sin el profile, cada `up.ps1` lo resucitaba y dejaba dos Postgres de Naeth vivos a la
   vez. El servicio tiene `restart: unless-stopped`, así que **`run --rm` no lo baja**: bájalo tú al
   terminar.
2. **No se pueden correr dos suites a la vez.** `conftest.py` hace `DROP DATABASE naeth_test WITH
   (FORCE)` en fixture de sesión: dos ejecuciones concurrentes se tiran la base mutuamente y dan rojo
   falso. Con varias sesiones de Claude Code abiertas, esto pasa de verdad.
3. **Tarda.** El compose hace `pip install` en cada run: 20-40 s en caliente, minutos en frío. No es
   un comando para lanzar a la ligera ni para meter en un automatismo.

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
