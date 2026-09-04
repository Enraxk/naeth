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
- `naeth/web/`: visor v2 (Vite + Svelte 5 + TS + Tailwind v4). **Es lo que se sirve desde el
  22/08/2026**. Queda UNA vista en stub, el Grafo, que degrada limpia; Nueva memoria y Ajustes ya
  están entregadas. Leer una nota **no monta el editor** desde el 04/09/2026: Crepe entra solo al
  pulsar Editar, y la lectura la pinta `lib/md.ts`. Estado,
  comandos, despliegue y trampas del editor en [`naeth/web/README.md`](naeth/web/README.md): míralo
  en vez de suponer hasta dónde llega. El visor v1 (`naeth/app/viewer/index.html`) se conserva sin
  ruta, como rollback (basta quitar `NAETH_VIEWER_DIR`) y como referencia.
- `pasos/` — histórico de diseño, Pasos 0-10. **Índice comentado en [`pasos/README.md`](pasos/README.md)**.
  Contiene material derogado; no lo apliques sin mirar antes ese índice.
- `docs/discovery/naeth.md` — qué es, arco del proyecto, convenciones y quirks. **Léelo antes de
  re-escanear el repo.**

## Comandos

**Pila viva:** `naeth/up.ps1` (o `up.sh`). Visor + API en `127.0.0.1:8800`; MCP en loopback sin auth
en `127.0.0.1:8801` (es por donde entra Claude Code, con `?s=code`).

**Tests del backend**, 28 en `app/tests/`:

```
docker compose --profile test run --rm test
docker compose rm -sf db          # al terminar, y SOLO asi (ver el punto 2)
```

El compose exige `CENIT_DB_PASSWORD` y las dos `OIDC_*` aunque el servicio `test` no las use: la
interpolación se evalúa sobre el fichero entero. Para una tanda suelta basta pasarlas en dummy por
delante del comando; para trabajar de verdad, `up.ps1`, que las saca de SOPS.

⚠ Cuatro cosas que hay que saber **antes** de lanzarlos, y que cuestan caro descubrir:

1. **Levanta el servicio `db`, que está retirado a propósito.** `docker-compose.yml:14-16` lo
   documenta: sin el profile, cada `up.ps1` lo resucitaba y dejaba dos Postgres de Naeth vivos a la
   vez. `run --rm` borra el contenedor del test, pero **no** las dependencias que levantó por
   `depends_on`, así que el `db` se queda vivo: bájalo tú al terminar.
   (Ya no tiene `restart: unless-stopped`; se le quitó el 02/08/2026, `docker-compose.yml:37`.)
2. **Para bajarlo, `docker compose rm -sf db`. NUNCA `down`.** `docker compose --profile test down`
   **no baja solo el profile: baja la pila entera**, api y viewer incluidos, y se lleva la red por
   delante. Pasó el 22/08/2026 y dejó Naeth caído hasta levantarlo con `up.ps1`. El `--profile` del
   comando engaña: filtra qué se arranca, no qué se para.
3. **No se pueden correr dos suites a la vez.** `conftest.py` hace `DROP DATABASE naeth_test WITH
   (FORCE)` en fixture de sesión: dos ejecuciones concurrentes se tiran la base mutuamente y dan rojo
   falso. Con varias sesiones de Claude Code abiertas, esto pasa de verdad.
4. **Tarda.** El compose hace `pip install` en cada run: 20-40 s en caliente, minutos en frío. No es
   un comando para lanzar a la ligera ni para meter en un automatismo.

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
