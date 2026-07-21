# Paso 10 · Autoría explícita: quién y qué escribió cada nota

**Proyecto Naeth (módulo `memory` de CENIT)** — sustituir el `source_client text` de texto
libre por autoría con **ejes separados**: canal verificado (producto/superficie/zona),
actor (humano/agente) y modelo declarado. Resolver además el histórico ya acumulado.

**Fecha**: 2026-07-20 · **cerrado 2026-07-21**
**Estado**: **COMPLETO Y EN PRODUCCIÓN**. Código + esquema + backfill + conectores con `?s=`
+ **`strict` activo**, todo verificado end-to-end desde Claude Code y claude.ai (§9).

---

## TL;DR

- **El canal se puede verificar; el modelo no.** MCP transmite `clientInfo` (medido:
  Claude Code manda `name="claude-code"`, `version="2.1.215"`) pero **ningún dato del
  protocolo lleva el modelo**. Autoría = una parte probada y otra declarada (§2).
- **Naeth ya es módulo de CENIT** (cutover 2026-07-17): usa el `OIDCProxy` de FastMCP
  contra Pocket-ID. **Todos los clientes comparten el mismo `client_id`** (el del módulo),
  así que etiquetar `client_id` NO distingue clientes. La identidad sale de otro lado (§2).
- **Ejes** en `memory.author jsonb`: `product` (de `clientInfo`, verificable), `surface`
  (de `?s=` del endpoint, verificable), `zone` (loopback/público), `actor`, y
  `vendor`/`model` DECLARADOS. Columnas generadas `author_product/surface/model` + índices.
- **Backfill sin catálogo**: el histórico se resolvió con el `path` (tu convención
  chat/code acierta 320/321) + el `source_client` legado. El **modelo del histórico es
  irrecuperable** → `unknown_legacy`. No se infiere.
- **`source_client` congelado** como legado (§6); se sigue rellenando legible (arreglado el
  bug del UUID recortado).

---

## 0. Motivo y el bug que había vivo

`source_client text NOT NULL DEFAULT 'web'` en cinco tablas, sin `CHECK` ni catálogo. Y
desde el cutover a CENIT (17/07) estaba **roto en producción**: el código consultaba la
tabla `oauth_client`, que el `OIDCProxy` ya no rellena, y caía a `mcp:<client_id[:12]>`.
Resultado: las notas nuevas salían como `mcp:8e732828-a34` (el id del módulo recortado),
sin autoría legible. Ver el diagrama `Diagramas/naeth-autoria.png`.

## 1. Lo que este paso NO hace

- No retira `source_client` (§6: congelado como legado).
- No infiere el modelo del histórico. Un dato que no se capturó **no se inventa**.
- No añade `author` a las otras 4 tablas (supersession/tombstone/relation/attachment): la
  autoría que importa es la de la nota. Si hace falta, se replica el patrón.
- No implementa el sync del catálogo (no hay catálogo; ver §8).

## 2. El límite del protocolo bajo CENIT

| Eje | De dónde sale | ¿Verificable? |
|---|---|---|
| `product` (`claude-code`/`claude-ai`/`naeth-web`) | `clientInfo.name` del handshake MCP | **Sí** (lo pone la app, no el LLM) |
| `surface` (`desktop`/`vscode`/`web`/`visor`) | query `?s=` del endpoint | **Sí** (lo fija la config del conector) |
| `zone` (`loopback`/`public`) | hay token OAuth o no | **Sí** |
| `actor` (`agent`/`human`) | canal MCP vs visor | **Sí** |
| `vendor`/`model` | declarados por el agente | **No** |

Dos hechos que fijan el diseño:
1. **El `client_id` no distingue clientes** bajo el OIDCProxy: es el del módulo `memory`,
   igual para claude.ai, Claude Code y todos. Por eso la superficie se resuelve con **un
   endpoint por superficie** (`?s=`), no con el `client_id`.
2. **MCP no transmite el modelo.** Se pide al agente por parámetro (`agent_model`), la
   descripción de la tool lo instruye, y se marca `model_source` para no confundir un dato
   declarado con uno probado.

## 3. Modelo de datos (implementado)

`memory.author jsonb NOT NULL DEFAULT '{}'`:

```json
{ "product": "claude-code", "surface": "desktop", "zone": "loopback",
  "actor": "agent", "vendor": "anthropic", "model": "claude-opus-4-8",
  "model_source": "declared",
  "client_raw": {"name": "claude-code", "version": "2.1.215", "client_id": null} }
```

Columnas generadas e indexadas para filtrar: `author_product`, `author_surface`,
`author_model` (`GENERATED ALWAYS AS (author->>'...') STORED`). Migración
`db/migrations/003-authorship.sql` (aditiva, idempotente; recrea la vista `memory_current`
porque `SELECT m.*` fija columnas al crearse). `schema.sql` actualizado para nuevas
instancias.

`model_source`: `declared` | `undeclared` | `unknown_legacy` | `human`.

## 4. Captura en escritura (implementado)

`app/mcp_server.py`: el helper `_authorship(agent_model, agent_vendor)` compone el jsonb
desde `clientInfo` (`get_context().session.client_params.clientInfo`), el `?s=`
(`get_http_request().query_params`), la presencia de token (zona) y lo declarado. Las 5
escrituras MCP lo usan; `memory_add`/`memory_supersede` lo guardan en `author`;
tombstone/relation solo derivan un `source_client` legible. El visor escribe con
`_HUMAN_AUTHOR` (`actor=human`, sin modelo). `core.add/supersede` aceptan `author: dict`.

**Verificado en vivo** (2026-07-20, desde Claude Code Desktop, loopback): capturó
`product=claude-code`, `zone=loopback`, `actor=agent`, `client_raw.name=claude-code`,
`version=2.1.215`. `surface=null` (aún sin `?s=`), `model=undeclared` (schema del cliente
cacheado).

## 5. Enforcement del modelo (§ decisión: strict, con matiz operativo)

`AUTHORSHIP_ENFORCE=warn|strict` (env, en compose `api`+`viewer`, default `warn`):
- **warn**: guarda aunque falte el modelo (`model_source=undeclared`).
- **strict**: rechaza con error **instructivo** ("reintenta pasando agent_model=...").

**Matiz que obliga a la secuencia**: activar strict bloquea a cualquier cliente que no
haya recargado el schema de las tools (el que ahora pide `agent_model`). El schema se
recarga al **reconectar el conector**. Por eso: reconectar clientes primero, activar strict
después. Ir directo arriesga dejar claude.ai/Claude Code sin escribir hasta reconectar.

## 6. `source_client`: congelado, arreglado

Sigue existiendo y rellenándose (es `NOT NULL` y el Paso 8 lo sincroniza), pero **deja de
ser la fuente de verdad**. Se arregló el bug: `_source_client(author)` deriva un valor
legible (`mcp:claude-code/desktop`), sin consultar la tabla `oauth_client` muerta ni
recortar el UUID. No se retira: es prueba del origen de las notas viejas y quitar una
columna `NOT NULL` de 5 tablas con sync pendiente es riesgo gratuito.

## 7. Backfill del histórico (EJECUTADO)

`db/migrations/004-authorship-backfill.sql` (UPDATE único, idempotente, `WHERE
author='{}'`). Deriva del `path` (producto) y `source_client` (actor/zona). **Ejecutado en
producción sobre 321 filas.** Resultado vigente: claude-ai 144, claude-code 92, todas
`unknown_legacy` (modelo irrecuperable). ADD-only no se rompe: `author` es columna nueva,
evento único, un solo nodo, con backup del 17/07.

⚠ **Superficie del histórico**: nunca se capturó → `null`. Los 144+ de Claude Code no
distinguen Desktop/VS Code (dato que el usuario es la única fuente y no consta).

## 8. Sync (Paso 8) y multi-nodo: implicación

`memory.author` viaja dentro de la fila (ADD-only, sin conflicto). Las columnas generadas
se recalculan en cada nodo (no se sincronizan). **No hay catálogo que sincronizar** (a
diferencia del diseño previo): la autoría llega resuelta en la escritura. Añadir a
[Paso 8](paso8-sync.md) §3: `author` como columna normal de `memory`.

**La autoría es robusta al multi-nodo, por diseño.** En el modelo local-first
([Paso 8](paso8-sync.md)), **Claude Code local NO se conecta a `finally`**: habla con el
módulo `memory` local por loopback (`127.0.0.1:8801`), y `finally` recibe las notas por
sync. Por eso `zone`/`surface`/`product` describen el **acto de escritura** (dónde y con
qué se escribió), no dónde acaba almacenada la fila: una nota escrita en Claude Code local
es `zone: loopback` en **ambos** nodos, porque así se escribió. `author` se captura en el
nodo de origen y viaja intacto; ningún nodo lo recalcula. claude.ai es aún más estable: su
autoría (`product: claude-ai`, `surface: web`, `zone: public`) es idéntica sirva el nodo
que sirva, porque depende del cliente, no del nodo.

⚠ **Abierto para Paso 8/9** (NO afecta al mecanismo de autoría): a qué nodo enruta
`memory.enraxk.dev` (el hostname público de claude.ai) cuando haya dos nodos vivos, y la
política de failover. La identidad cross-node (clave HS256 compartida) ya está verificada
viable, así que el token de claude.ai valdría en cualquier nodo; **cuál** lo sirve es
decisión del despliegue, no de este paso.

## 9. Cierre y verificación end-to-end (2026-07-21)

**Conectores** (dos ecosistemas separados, ver §11):
- Claude Code (terminal y VS Code, conector global de `~/.claude.json`) →
  `http://127.0.0.1:8801/mcp?s=code`
- claude.ai **y la app Claude Desktop** (comparten conector, van con la cuenta) →
  `https://memory.enraxk.dev/mcp?s=web`

**Verificado en producción, con escrituras reales de ambos clientes:**

| Comprobación | Resultado |
|---|---|
| `?s=` atraviesa Cloudflare + Caddy | **Sí**: claude.ai capturó `surface=web`. (Caddy: el matcher `path` ignora el query y `reverse_proxy` preserva la URI; probado además con `/healthz?s=...`) |
| Claude Code captura superficie | `surface=code`, `zone=loopback`, `product=claude-code` |
| claude.ai captura superficie | `surface=web`, `zone=public`, `client_id=8e732828-a348-…` (**confirma** que el `client_id` es el del módulo, común a todos) |
| ¿Declaran el modelo solos? | **Sí, los dos**, sin que se les pida: `model=claude-opus-4-8`, `model_source=declared` |
| `strict` activo | Sin `agent_model` → **rechazo instructivo**; reintento declarándolo → guardado OK |

**`AUTHORSHIP_ENFORCE=strict`** fijado en `naeth/.env` (persistente entre reinicios) y
desplegado con `up.ps1`. Se activó **solo tras comprobar** que ambos clientes declaran el
modelo por su cuenta.

⚠ **Si añades un cliente nuevo**: hasta que reconecte y cargue el schema de las tools (con
`agent_model`) no podrá escribir en `strict`. Bajar a `warn` mientras tanto.

## 10. Bug encontrado al cerrar: el mapeo de `product`

claude.ai se identifica como **`Anthropic/ClaudeAI`** (junto, sin guion ni punto), no como
`claude-ai`. El mapeo inicial solo contemplaba `claude-ai`/`claude.ai`, así que la primera
nota real de claude.ai quedó con `product="anthropic/claudeai"` en vez de `claude-ai`.
**Arreglado**: `_product_from_client_name` compara ahora sobre la forma *aplanada* (sin
separadores ni mayúsculas). Cubierto por el test `test_product_from_client_name_valores_reales`
con los valores REALES medidos. El fallo fue reparable **porque `client_raw` guarda el
nombre crudo**: sin ese campo se habría perdido el dato.

Valores medidos (2026-07-21): Claude Code → `claude-code` v2.1.215 · claude.ai y app
Claude Desktop → `Anthropic/ClaudeAI` v1.0.0.

## 11. Tres productos, dos ecosistemas (aclaración de nombres)

Confusión recurrente: **Claude Desktop** (la app de escritorio de *chat*) NO es **Claude
Code**. Son ecosistemas distintos:
- **claude.ai + app Claude Desktop**: comparten conector, que va con la **cuenta**. Ambos
  caen bajo `surface=web` y el mismo `clientInfo` (`Anthropic/ClaudeAI`). Para separarlos
  haría falta que su `clientInfo` difiriera (no medido: no se puede probar cómodamente,
  porque un prompt en la app no llega a la sesión de Claude Code).
- **Claude Code** (terminal o extensión de VS Code): conector **local** en `~/.claude.json`,
  compartido entre ambas formas → una sola superficie `code` (§2).

## 10. Decisiones tomadas

1. Canal verificado por `clientInfo` + endpoint por superficie, **no** por `client_id` (que
   bajo CENIT es común a todos los clientes).
2. Modelo declarado por el agente, por imposibilidad del protocolo.
3. Producto/superficie/zona se **capturan** en la escritura (no hay catálogo ni resolución
   en lectura: el cutover a CENIT lo hizo innecesario y más simple).
4. Backfill del histórico con `path`+`source_client`; modelo `unknown_legacy`.
5. `source_client` congelado y arreglado, no retirado.
6. Enforcement `strict` elegido, aplicado tras reconectar clientes.
