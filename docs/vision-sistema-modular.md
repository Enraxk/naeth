# Visión: sistema personal compacto y modular (núcleo + módulos "Lego")

> Dirección elegida el 2026-07-07 (fin de una sesión larga). Es la evolución de todo lo trabajado:
> en vez de N servidores MCP sueltos que reinventan la fontanería, **un núcleo compacto que la monta
> una sola vez** y del que **cuelgan capacidades como piezas de Lego**. "Todo a mano": un solo sitio,
> un solo login, y añades funciones enchufándolas.

## La visión en una frase
Un **núcleo** provee lo compartido una vez (identidad/login, exposición segura, secretos, sustrato de
datos, un **panel único**, y un **registro de módulos**); los **módulos** aportan capacidades
(memoria, imágenes, y futuros) reutilizando el núcleo, sin duplicar auth/túnel/etc.

## Reparto propuesto (a confirmar)
- **NÚCLEO (compacto, 1 vez):** identidad/login (IdP central) · exposición (túnel + edge + gateway) ·
  secretos · sustrato de datos · panel único (shell/dashboard) · registro/enchufe de módulos.
- **MÓDULOS (Lego):** `memoria` (lo de Naeth) · `imágenes` (backend intercambiable) · futuros
  (`tareas`, `notas`, `finanzas`… lo que sea).

## Por qué esto resuelve lo de ComfyUI
Lo que a Eneko NO le gusta es **ComfyUI de fondo permanente** (no la generación local en sí). En el
diseño modular, `imágenes` es un **módulo con backend intercambiable**: el módulo expone las mismas
tools y el motor de debajo es un detalle swappable —
- **local on-demand** (cargar el modelo solo al generar, sin proceso permanente), o
- **cloud** (Nano Banana / FLUX — mejor calidad, cero proceso local, céntimos/imagen), o
- lo que venga.
Así desaparece el "ComfyUI de fondo" sin renunciar a tener imágenes en el sistema.

## Por qué es realista (no humo)
- **Naeth ya es ~80% un núcleo:** tiene identidad/OAuth, túnel, sustrato (Postgres) y un shell (el visor).
  Podría ser la SEMILLA del núcleo, con "memoria" como su primer módulo.
- **FastMCP sabe montar sub-servidores** en un mismo proceso → un host compacto que hospeda varios
  módulos bajo UNA auth y UN túnel. La modularidad mapea a un patrón real.

## Decisiones abiertas (retomar aquí en el nuevo chat)
1. **¿Naeth es la semilla del núcleo** (todo se monta sobre él, más rápido) **o un núcleo nuevo y neutro**
   donde Naeth pasa a ser un módulo más (más limpio conceptualmente)?
2. **¿El reparto núcleo/módulos de arriba cuadra**, o se mueve algo?
3. Backend por defecto del módulo `imágenes` (local on-demand vs cloud).

## Relación con la seguridad/centralización ya diseñada
Todo lo de `docs/arquitectura-objetivo-mcp.md` (IdP central Pocket-ID, allowlist de IP, bypass local por
loopback, forward-auth para UIs, secretos SOPS+age, tokens Fernet, plan por fases) **sigue vigente**:
es la CAPA de seguridad/exposición del núcleo. La visión modular la envuelve; no la contradice.

## Estado actual (NO romper — todo funcionando)
- **comfy-mcp** operativo: ComfyUI `:8188` + servidor MCP `:9100` (OAuth propio) + túnel
  `comfy.enraxk.dev` por tareas programadas. Persistente.
- **Naeth** operativo, con el **tapón de seguridad aplicado** (visor `/` y `/api` → 404 al edge, en las
  dos copias del config). Solo `/mcp` + OAuth públicos.
- Esta visión es un **rediseño futuro**, no urgente. Nada de esto corre prisa.

## Empezar el nuevo chat por…
Confirmar decisión 1 (Naeth-semilla vs núcleo-nuevo) y el reparto núcleo/módulos → dibujar el concepto
(núcleo + módulos enchufables) → y de ahí, plan de construcción. Docs relacionados en `docs/`:
`arquitectura-objetivo-mcp.md`, `investigacion-seguridad-centralizacion.md`.
