# Paso 4 · Naeth como app web de gestión (diseño en papel)

**Proyecto Naeth** — diseño de la aplicación web de gestión autohospedada sobre el
motor validado en el Paso 3.

**Fecha**: 2026-05-30
**Alcance**: diseño documental. Modelo de autenticación, estrategia de exposición
segura en el VPS, enfoque del grafo de relaciones, CRUD sobre el corpus y
arquitectura del frontend. **Sin código** (eso es Paso 5).
**Insumo**: `paso3-spike.md`, `paso3-resultados.md` (motor validado: hot tier
rápido, recall sub-segundo hasta 1M, sin LLM) y el visor de composición en `spike/viewer/`.
**Reglas autoimpuestas**:
1. No re-decidir la arquitectura de memoria (Pasos 1-3). Esto es la capa de UI/control.
2. Cada decisión cita la evidencia o el principio que la respalda; marca `⚠ a decidir`
   lo que requiere tu input.
3. No reinventar lo que Basic Memory u Obsidian ya hacen sobre los mismos `.md`.
4. La seguridad de la exposición remota se diseña explícitamente, no se improvisa.

---

## 1. Qué es (y qué no)

**Es**: una aplicación web autohospedada que da **control humano total** sobre la
memoria de Naeth desde cualquier dispositivo con navegador: navegar el árbol de
notas, crear/editar/borrar/mover, ver un grafo de relaciones, y observar el estado
del sistema (lo que ya hace el visor). Con login.

**No es**: un backend de memoria nuevo (ese es Basic Memory, ya decidido), ni un
editor colaborativo en tiempo real, ni multi-usuario/equipos, ni una app nativa.

**Principio rector — plano de control, no silo.** Como el almacén *es* Markdown en
disco (Paso 1 §2.4), la app web es una **vista de control sobre datos que siguen
siendo portables**. Tres interfaces sobre **un único corpus soberano**:

- **Web app** → interfaz **humana** (cualquier dispositivo, este Paso 4).
- **MCP** → interfaz de **agentes** (claude.ai / Claude Code).
- **Obsidian** (opcional) → interfaz de **power-user** local.

Las tres operan sobre los mismos `.md` + el índice de Basic Memory. Coherencia
garantizada porque **todas las escrituras pasan por la API/índice de Basic Memory**
(no se tocan ficheros por debajo sin reindexar).

---

## 2. Lo que NO hay que construir (reutilizar antes que crear)

| Necesidad | Ya resuelto por | Naeth solo añade |
|---|---|---|
| CRUD de notas | Basic Memory: `write_note`, `edit_note`, `delete_note`, `move_note` | cablear a la web |
| Árbol de carpetas | filesystem + `list_directory` | render navegable |
| Relaciones por wikilink | tablas entity/relation + `build_context` | render de grafo |
| Edición Markdown + grafo local | **Obsidian** sobre los mismos `.md` | (coexiste, no se reemplaza) |
| Búsqueda híbrida | Basic Memory (FTS + vec0) | UI de búsqueda (ya en el visor) |

**Lo genuinamente nuevo de Naeth** (lo que justifica construir y no solo usar Obsidian):
1. **Una URL con login desde cualquier navegador, sin instalar nada** por equipo.
2. **Grafo con aristas semánticas** (no solo wikilinks) — ver §5.
3. **Vista de composición integrada** (tiers + bus) en la misma app — ya existe.

---

## 3. Autenticación · decisión

Es un sistema **personal de un solo usuario**. No hace falta RBAC, ni registro, ni
multi-tenant. Regla de oro: **no rodar criptografía propia**.

### Opciones

- **A · App-level**: FastAPI con contraseña (hash **argon2id**) + sesión en cookie
  **HTTP-only, Secure, SameSite=Strict** firmada. Autocontenido, simple. 2FA (TOTP)
  añadible. Riesgo: la superficie de auth la mantienes tú.
- **B · Proxy de auth**: **Authelia** (o oauth2-proxy) delante; la app confía en el
  proxy. Da 2FA, rate-limit y políticas sin tocar el código. Más piezas que operar.
- **C · Sin exposición pública (VPN)**: la app **no se publica a internet**; se
  alcanza solo por **Tailscale/WireGuard**. Accesible desde todos *tus* dispositivos,
  **invisible para el resto de internet**. La auth de la app pasa a ser una segunda
  capa, no la única barrera.

### Recomendación

**C + A**: poner la app detrás de **Tailscale** (cero exposición pública, gratis para
uso personal, funciona desde móvil/portátil/cualquier equipo tuyo) **y** además login
app-level argon2 + cookie firmada como segunda capa. Para una **memoria personal**, la
postura "no publicada + VPN" reduce la superficie de ataque de forma drástica frente a
"HTTPS público + login", a coste operativo menor. Si algún día necesitas acceso desde
un equipo ajeno (sin Tailscale), se añade la ruta pública detrás de **Authelia + 2FA**.
`⚠ a decidir`: ¿te vale el modelo VPN (Tailscale) o necesitas URL pública abierta?

---

## 4. Exposición segura en el VPS · decisión

Independientemente de auth, el despliegue en el VPS Ubuntu:

- **Reverse proxy**: **Caddy** (HTTPS automático con Let's Encrypt, config mínima) o
  nginx + certbot. La app FastAPI escucha solo en `127.0.0.1`; el proxy termina TLS.
- **Firewall**: `ufw` — solo 22 (SSH, idealmente por Tailscale), 80/443 si hay ruta
  pública. Si todo va por Tailscale, **ni 80/443 abiertos al mundo**.
- **Hardening**: SSH por clave (no password), `fail2ban`, actualizaciones automáticas,
  backups de los `.md` (que es todo el dato — git o restic).
- **Datos en reposo**: los `.md` son texto plano en disco. Si quieres cifrado en
  reposo, LUKS en el volumen o un directorio cifrado. `⚠ a decidir` si hace falta.

**Recomendación**: Tailscale para acceso + Caddy escuchando solo en la interfaz
tailnet (o en localhost tras Tailscale). Sin puertos públicos. Backups de los `.md`
con restic a un destino aparte (la soberanía del dato exige que no viva en un solo sitio).

---

## 5. Grafo de relaciones · decisión (el diferenciador)

Sin LLM (decisión del Paso 3), las relaciones vienen de dos fuentes, y aquí Naeth
**supera a Obsidian**:

1. **Aristas explícitas — wikilinks `[[...]]`**: de las tablas relation de Basic
   Memory. Es lo que Obsidian pinta. Línea **sólida**.
2. **Aristas semánticas — vecinos vec0**: kNN sobre los embeddings de las notas
   (los que ya medimos). "Qué se *parece*", aunque no lo hayas enlazado a mano.
   Obsidian **no** hace esto. Línea **discontinua**, con umbral de similitud ajustable.

### Render y escala

- **Subgrafo de vecindad, no el grafo entero**: como Obsidian (local graph), se
  centra en una nota y muestra sus relaciones a profundidad N. **No** se mandan 100k
  nodos al navegador. El kNN semántico se calcula **en el servidor bajo demanda**
  (medido: ~44 ms a 100k notas, Paso 3 — perfectamente viable on-demand).
- **Librería**: **Cytoscape.js** (maduro, layouts fcose, interacción) para escala
  personal. Si algún día se quiere el grafo global con decenas de miles de nodos,
  **sigma.js** (WebGL). `⚠ a decidir` al construir; Cytoscape para v1.

---

## 6. CRUD y árbol · decisión

- **Árbol**: estructura de carpetas de los `.md` (Basic Memory `list_directory` /
  filesystem). Navegable, plegable.
- **Editar**: cargar el `.md`, editor Markdown (textarea + preview, o CodeMirror/
  Milkdown ligero), guardar vía `edit_note`/`write_note`. `⚠ a decidir` editor.
- **Borrar / mover / renombrar**: `delete_note` / `move_note`.
- **Regla dura**: **toda escritura pasa por la API de Basic Memory** (no escribir
  ficheros a mano sin reindexar), para que índice FTS, vectores y grafo queden
  consistentes. Si se escribe directo a disco, hay que disparar `sync` después.

---

## 7. Arquitectura del frontend · decisión

- **Opción A · vanilla + Design DNA** (como el visor actual): cero build, encaja con
  local-first, deps mínimas vía CDN solo donde hacen falta (Cytoscape.js, editor MD).
- **Opción B · SPA ligera** (Svelte/Vue): mejor gestión de estado para árbol+editor+
  grafo+rutas, a costa de un paso de build.

**Recomendación**: empezar **A (vanilla + DNA)** por coherencia visual y zero-build,
reusando el CSS Terminal × Notion ya establecido. Reevaluar a B solo si el estado se
vuelve inmanejable (probablemente al integrar el editor + grafo + rutas). No casarse.

---

## 8. Arquitectura propuesta (un vistazo)

```
   cualquier dispositivo tuyo
            │  (Tailscale · sin exposición pública)
            ▼
   ┌──────────────────────────┐      ┌───────────────────────────┐
   │  Caddy (HTTPS, localhost) │ ───▶ │  FastAPI · Naeth app       │
   └──────────────────────────┘      │  - auth (argon2 + cookie)  │
                                      │  - CRUD  (vía Basic Memory)│
   claude.ai / Claude Code ──MCP────▶ │  - árbol / búsqueda        │
                                      │  - grafo (wikilink + vec0) │
                                      │  - visor de composición    │
                                      └────────────┬──────────────┘
                                                   ▼
                                   Basic Memory (índice FTS+vec0)
                                                   ▼
                                   corpus .md  ◀── Obsidian (opcional)
                                   (fuente de verdad soberana)
                                                   ▼
                                   backups restic/git (dato no vive en un solo sitio)
```

---

## 9. Fases de construcción (Paso 5, si se aprueba este diseño)

1. **P5.1 · Auth local**: login argon2 + sesión cookie; todo el resto detrás de auth.
2. **P5.2 · Árbol + lectura**: navegar carpetas y leer notas (sobre el visor actual).
3. **P5.3 · CRUD**: editar/borrar/mover vía Basic Memory, índice consistente.
4. **P5.4 · Grafo**: subgrafo de vecindad con aristas wikilink + semánticas (vec0).
5. **P5.5 · Endurecimiento + remoto**: Tailscale + Caddy + firewall + backups en el VPS.

Local primero (P5.1–P5.4 en Windows), exposición segura al final (P5.5 en el VPS).

---

## 10. Preguntas abiertas (tu input antes del Paso 5)

1. **Modelo de acceso**: ¿VPN (Tailscale, recomendado) o URL pública abierta detrás de
   Authelia+2FA? Esto condiciona toda la fase de seguridad.
2. **¿Cifrado en reposo** de los `.md` en el VPS, o basta con permisos + backups cifrados?
3. **Editor Markdown**: ¿textarea+preview minimalista, o editor enriquecido (CodeMirror/Milkdown)?
4. **Alcance del grafo**: ¿solo vecindad alrededor de una nota (recomendado), o también
   un grafo global (que obligaría a sigma.js/WebGL)?
5. **¿La app sustituye a Obsidian o coexisten?** (Coexisten sin coste — mismos `.md` —;
   pero define si la web debe cubrir el 100% para no depender de Obsidian.)

---

## 12. Adenda (2026-05-30) · sustrato Postgres + alcance v1

Tras el Paso 5, el sustrato canónico es **Postgres + pgvector** (no Markdown/Basic
Memory). Esto actualiza el diseño de arriba:

**Decisiones §10 resueltas:**
- q1 acceso: **Cloudflare Tunnel `enraxk` + Access**, `naeth.enraxk.dev` → `localhost:8008`.
- q2 cifrado: **LUKS** para `pgdata` + adjuntos (el server `finally` no tiene cifrado hoy).
- q3 editor: **Milkdown** (roadmap, no v1).
- q4 grafo: **vecindad + global con toggle**, estética heptápoda (roadmap).
- q5: **sustituye a Obsidian al 100%**.
- q6 adjuntos: **binario en disco LUKS + sidecar `memory`** (ver `paso6-esquema.md` §4).

**Qué cambia del modelo de datos** (detalle en `paso6-esquema.md`):
- Nodos = **filas** en `memory`, no ficheros `.md`.
- El "árbol de carpetas" pasa a ser **jerarquía lógica** por el campo `path`.
- El grafo = tabla `relation` (aristas explícitas) + **pgvector kNN** (aristas semánticas, bajo demanda).
- Todo lo demás del Paso 4 se mantiene (túnel, LUKS, Milkdown, grafo global+vecindad, heptápodo, adjuntos).

**Alcance v1 (decisión de sesión):** la **primera versión de la web = el visor de
composición ya construido** (`spike/viewer/`), re-plataformado al stack nuevo (FastAPI +
Postgres, expuesto por el túnel `enraxk` + Access). Mismas vistas adaptadas:
- Estado del sistema: total de memorias, **cola de embeddings** (pendientes/hechas, desde `job`), desfase.
- Escribir una memoria y verla fluir (alta síncrona + encolado del embedding).
- Búsqueda híbrida con latencia mostrada.

Lo avanzado (árbol navegable + CRUD + Milkdown + grafo heptápodo + adjuntos + login
completo) es **roadmap posterior**, se irá metiendo encima de esa v1. En Postgres ya no
hay "dos tiers": el "hot" es la query síncrona y el "enrichment" es el job de embeddings;
el visor se adapta a mostrar eso.

---

## 11. Lo que NO está en este documento (intencional)

- Código del backend, frontend o config del proxy (Paso 5).
- Re-decisión de la arquitectura de memoria (Pasos 1-3) ni del enrichment (Fase B).
- Esquema de base de datos propio: no lo hay — la verdad son los `.md` + el índice de
  Basic Memory.
- Diseño visual nuevo: se reutiliza el Design DNA "Terminal × Notion" existente.

---

**Fin del Paso 4.** Próximo paso: con tus respuestas a §10, construir por fases
(P5.1→P5.5), local primero y exposición segura al final.
