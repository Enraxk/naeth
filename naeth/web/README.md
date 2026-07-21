# Naeth · visor v2

Visor de gestión de Naeth: SPA en **Vite + Svelte 5 (runes) + TypeScript + Tailwind v4**.
Sustituye al visor v1 vanilla (`../app/viewer/index.html`, que queda como referencia).

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173 — proxy de /api -> 127.0.0.1:8800 (pila Docker)
```

La pila de Naeth (Postgres + FastAPI + worker) debe estar levantada (`docker compose up` en `../`)
para que `/api/*` responda.

## Build / type-check

```bash
npm run build    # -> dist/  (lo sirve FastAPI en prod; ajustar el custom_route "/")
npm run check    # svelte-check (tipos)
```

## Estructura

- `src/lib/` — capa de datos tipada (`api.ts`, `types.ts`), utilidades (`icons`, `colors`, `format`)
  y *stores* reactivos (`*.svelte.ts`: `theme`, `router`, `prefs`, `data`, `search`, `ui`).
- `src/components/` — `Header`, `Sidebar`, `Rail`, `Crumbs`, `Footer`, `Icon`.
- `src/views/` — `Inicio`, `Estado`, `Memoria`, `Stub`.
- `src/app.css` — tokens de diseño (Tailwind `@theme` + CSS vars, tema claro/oscuro).
