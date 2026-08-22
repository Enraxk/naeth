# Naeth · visor v2

Visor de gestión de Naeth: SPA en **Vite + Svelte 5 (runes) + TypeScript + Tailwind v4**.

**Desde el 22/08/2026 es lo que se sirve en producción**, en los dos puertos y por
`naeth-visor.enraxk.dev`. El visor v1 (`../app/viewer/index.html`) se conserva sin ruta, como
rollback y como referencia.

## Desarrollo

```bash
npm ci
npm run dev -- --port 5180 --strictPort
```

El puerto 5180 y `--strictPort` no son capricho: el 5173 lo ocupa el dev server de Yog-IN y, sin
`--strictPort`, Vite se va solo al 5174 y la configuración apunta a un puerto que no es. Hay una
entrada `naeth-visor` en `.claude/launch.json` que lanza justo eso.

El dev server proxya `/api` a `127.0.0.1:8800`, o sea **contra la memoria de producción**: la pila
tiene que estar levantada (`../up.ps1`).

⚠ **Node no está en el PATH de una sesión nueva.** Vive en `F:\local\fnm\aliases\default` (v24.19.0,
npm 11.17.0) vía fnm, y `fnm list` solo lo encuentra con `FNM_DIR=F:\local\fnm`.

## Comprobar

```bash
npm test         # Vitest: lógica pura (wikilinks, árbol, formatos)
npm run check    # svelte-check: tipos
npm run build    # -> dist/
```

Las tres tienen que pasar antes de dar nada por bueno, y **ninguna ejecuta la aplicación**: un
componente puede compilar limpio y reventar al montarse. Lo que toque la UI se verifica además en
el navegador.

Vitest se configura dentro de `vite.config.ts` a propósito. El `.gitignore` de la raíz tiene `*.json`
(por las credenciales de cloudflared) con excepciones una a una, así que un `vitest.config.json`
nacería sin versionar y el runner no arrancaría en otro clon.

## Despliegue

**Cada nodo lo recibe por una vía distinta**, y las dos rutas son diferentes a propósito.

En el **PC**, por bind-mount, para poder iterar sin reconstruir la imagen:

```yaml
# docker-compose.yml, en los servicios `api` y `viewer`
environment:
  NAETH_VIEWER_DIR: /srv/viewer
volumes:
  - ./web/dist:/srv/viewer:ro
```

```bash
npm run build
cd .. && ./up.ps1        # recrea api y viewer
```

En el **VPS `finally`**, desde la imagen: el `Dockerfile` es multi-stage y compila el front con
Node 22 en una etapa aparte, dejándolo en `/srv/viewer-build`, que es a donde apunta el
`NAETH_VIEWER_DIR` del override. Allí basta lo de siempre:

```bash
cd /opt/naeth && git pull && cd naeth && ./up.sh --build
```

Se hace así porque `dist/` no está versionado (un `git pull` no lo trae) y el Node de ese host es
el 18, que Vite 8 ya no admite. **Las rutas son distintas** porque el override no puede retirar un
solo volumen de la lista, así que el bind-mount del compose base también se aplica allí: con la
misma ruta, Docker crearía un `web/dist` vacío y lo montaría encima del build.

Dos cosas que no son obvias y cuestan caro:

- **`app/` se monta con `--reload`.** Escribir ahí los 192 ficheros del build dispararía el
  hot-reload y dejaría colgado a `naeth-viewer-1`, que es por donde entra Claude Code. De ahí el
  bind-mount aparte.
- **No basta con apuntar la ruta `/` al build.** El v1 era un HTML único con todo inline; un build
  de Vite pide además `/assets/index-<hash>.js` y `.css`, y eso no lo servía nadie. Lo monta
  `mcp_server.py`, y solo si el directorio existe (si no, un GET devolvía 500 en vez de 404).

**Rollback:** quitar `NAETH_VIEWER_DIR` del compose y recrear. Vuelve el v1 sin revertir código,
porque ese es el valor por defecto.

**Verificar que lo servido es de verdad el build**, y no el v1 con otra cara:

```bash
curl -s http://127.0.0.1:8801/ | grep -c 'assets/index-'
```

Tiene que dar 1 o más. Con el v1 daba 0. En el VPS, donde el viewer no publica puerto, se
comprueba por dentro del contenedor:

```bash
docker exec naeth-viewer-1 python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/').read().decode().count('assets/index-'))"
```

Que un nodo se quede con la versión vieja no es hipotético: pasó el mismo 22/08, y lo detectó la
comprobación de deriva del `healthcheck.sh` de CENIT, que vigila `/opt/naeth` y avisa por ntfy a
las 24 horas. Si vuelve a saltar `version-naeth`, esto es lo que hay que ejecutar.

## Estructura

- `src/lib/`: capa de datos tipada (`api.ts`, `types.ts`), utilidades (`icons`, `colors`, `format`,
  `wikilinks`) y *stores* reactivos (`*.svelte.ts`: `theme`, `router`, `prefs`, `data`, `search`,
  `ui`). Los `*.test.ts` viven junto a lo que prueban.
- `src/components/`: `Header`, `Sidebar`, `Rail`, `Crumbs`, `Footer`, `Icon`, `Milkdown`.
- `src/views/`: `Inicio`, `Estado`, `Memoria`, `Stub`.
- `src/app.css`: tokens de diseño (Tailwind `@theme` y CSS vars, tema claro y oscuro).

## Alcance

| Vista | Estado |
|---|---|
| Inicio | Implementada |
| Estado del nodo | Implementada |
| Memoria (lectura y edición) | Implementada |
| Grafo | Stub |
| Nueva memoria | Stub (`POST /api/memory` ya existe: falta el front) |
| Ajustes | Stub (el tema se cambia en el rail) |

Las tres stub degradan con icono, explicación y badge. Lo pendiente está en
[`../../docs/plan/visor-v2-cierre.md`](../../docs/plan/visor-v2-cierre.md).

## Trampas del editor

Milkdown (Crepe) **normaliza el markdown al serializar**, y eso no es cosmético: escapaba `[`, `]` y
`_`, de modo que `wal_level` salía como `wal\_level` y los `[[wikilinks]]` como `\[\[...\]\]`, que
ya no resuelven. Medido el 22/08/2026: habría corrompido **242 de las 411 memorias vigentes** al
editarlas. Se corrige en `unescapeMarkdown()` (`src/lib/wikilinks.ts`), aplicada en el único punto
por el que sale texto del editor, y hay tests que lo fijan.

Por lo mismo, `dirty` se compara contra el markdown **que devuelve el editor recién montado**, no
contra el contenido guardado: si no, el editor nacía "modificado" sin tocar nada y dejaba borradores
espurios en localStorage.

El CSS de Crepe se importa en runtime, o sea **después** de `app.css`, y a igual especificidad gana
el suyo. Se resuelve repitiendo la clase (`.label-wrapper.label-wrapper`), nunca con `!important`.
