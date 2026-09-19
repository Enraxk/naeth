# Verificación: qué de CENIT es foso real y qué era una frase de README

**Fecha**: 09/09/2026. **Contra**: el código de `F:\src\CENIT` y `F:\src\Naeth`, no contra el corpus.

Existe porque el 09/09 se planteó "Naeth como producto con CENIT dentro" apoyándose en memorias
escritas en su día, ninguna comprobada contra el código de hoy. El propio corpus tiene registrado
tres veces el patrón que se estaba repitiendo: un documento propio afirma algo, nadie lo comprueba,
y acaba sosteniendo una decisión.

**Requisito que gobierna todo lo que salga de aquí** (Eneko, 09/09): el producto final tiene que ser
**el mismo que él usa y sobre el que sigue desarrollando**. No hay una rama "producto" y otra "mi
instalación": hay un producto, y lo suyo es una instancia de ese producto.

---

## Tabla de veredictos

| # | Afirmación | Veredicto |
|---|---|---|
| 1 | Pocket-ID es el IdP y está en uso de verdad | **CONFIRMADO** en runtime |
| 2 | El reconciler regenera la config de enrutado desde manifests | **PARCIAL**: genera **un fichero** de 29 líneas |
| 3 | SOPS + age con un verificador que descifra | **CONFIRMADO**, y más sólido de lo que se creía |
| 4 | Failover local-preferente con árbitro por epoch | **CONFIRMADO** |
| 5 | `sync.py` funde por unión y `classify()` aborta | **CONFIRMADO** |
| 6 | El panel del núcleo es localhost-only | **CIERTA, mal leída por mí**: no hay panel porque se decidió no construirlo |
| 7 | El reconciler enruta el PC pero no el VPS | **CONFIRMADO**, y peor: no hay canal automático posible |
| 8 | Llega identidad de persona al código de Naeth | **CONFIRMADO: llega y se tira sin leer** |
| 9 | Cero columnas de usuario en 15 tablas | **PARCIAL**: cero columnas, sí; son 10 tablas de dominio |
| 10 | CENIT está atado a esta máquina | **CONFIRMADO**, con 3 ataduras que rompen el arranque |
| 11 | Existe camino de instalación desde cero | **DESMENTIDO**: no existe, ni parcialmente |
| 12 | Naeth puede correr sin CENIT | **DESMENTIDO tal como se entrega**, pero está a un compose de conseguirlo |

---

## Lo que es foso real y defendible

**El respaldo cifrado y su verificador** (`secrets/verificar-recuperacion.ps1`). Descifra de verdad
(`:131` con `sops -d`, `:162` con `age -d`), comprueba la cabecera del plano (`:175-176`, `PGDMP` y
`PK`) y **aborta si existe `keys.txt` o `SOPS_AGE_KEY_FILE`** (`:65-75`) para que la prueba no dé un
falso verde con la clave de siempre. El backup también verifica descifrando y lanza
`"descifra pero pg_restore no lee su indice -- backup inservible"` (`core/ops/backup.ps1:88`).
Dos destinatarios age en `.sops.yaml:11`.

**El failover.** El árbitro no es un servicio: **es el remoto de git**. `GitArbiter.publish()`
(`core/ops/.../ownership.py:203-220`) hace commit y push, y si el push se rechaza lanza
`SplitBrainError` (`:215`). El epoch solo sube (`validate_monotonic`, `:101-108`), hoy va por 162. Sin
árbitro tras tres reintentos no se adquiere nada (`:196-201`). Y la degradación del nodo obsoleto no
es solo `ALTER ROLE ... read_only` (`:225-242`) sino también `recycle_connections_sql` (`:256-290`),
que existe porque el ALTER solo lo ven las conexiones nuevas y el pool dejó el failover roto en
silencio (P8, 26/07/2026).

**El sync.** `MERGE_TABLES` (`sync.py:81-87`) funde con `INSERT ... ON CONFLICT (id) DO UPDATE` y
reglas monótonas de semilattice (`:120-126`: `is_current` es AND, `embedding` es COALESCE).
`classify()` no tiene default y aborta ante tabla desconocida (`:143-145`), con un guardarraíl previo
al handoff (`:341-346`). No es teórico: `_emdash_backup` sin clasificar tumbó el `recover` del 30/07
con el sistema ya sin líder (`sync.py:106-108`).

**Pocket-ID.** Contenedor vivo `cenit-identity-pocket-id-1` (v2.10.0, healthy, `127.0.0.1:1411`),
levantado por `core/identity/docker-compose.yml:33-49`. Valida tokens de verdad, medido: `POST
127.0.0.1:8800/mcp` sin token devuelve **401** con `www-authenticate: Bearer`. Consumido por
`naeth/app/mcp_server.py:90-94`.

## Lo que NO es foso

**No existe ningún panel del núcleo.** No hay bind address que citar porque no hay proceso que lo
abra, y el reconciler no tiene comando `serve`. Lo único parecido es `cenit-lanhealth`, que **no es
un panel y no es localhost**: publica `0.0.0.0:8899` (`core/ops/lanhealth/docker-compose.yml:16`),
acotado solo por una regla de firewall de Windows que hay que poner a mano.

⚠ **Corrección del 09/09, al hacer el checkpoint: esto NO desmiente la memoria `b18d7cda`, y
presentarlo como tal era un error de lectura mío.** Esa memoria no afirma que exista un panel: es una
DECISIÓN de diseño del 08/07 que dice que el panel del núcleo se minimiza "a un `core status` por
CLI + como mucho una página de estado local trivial", sin login y nunca expuesto, con un escape hatch
explícito ("ahora no pica, no se construye"). El `core status` por CLI **sí existe**. Y el escape
hatch se activó el 01/08 (`a1dee811`): los controles de CENIT viven en **Krépis**, app local en zona
loopback, previstos para su v1.x. Así que no hay panel **porque se decidió que no lo hubiera**, no
por una promesa incumplida. Lo aspiracional sin código es solo la frase "1 login, 1 panel" de
`README.md:45` y `CLAUDE.md:25`, que describe la plataforma como se imaginó en julio.

**El reconciler es mucho menos de lo que se cree.** Es un CLI Typer one-shot, cierto
(`cli.py:24`), pero `desired_artifacts()` devuelve exactamente un fichero:

```python
generate.py:95-97   return {"Caddyfile.modules": render_caddyfile_modules(manifests)}
```

29 líneas de Caddy generadas desde **un único manifest** (`core/modules/memory.yaml`).
`core/templates/` **está vacío**: su README describe tres ficheros de las "Fases 2-3" que no existen.
`core add <slug>` es un stub que imprime "pendiente" (`cli.py:132-134`). No genera el ingress del
túnel, ni docker-compose, ni esquema, ni cliente OIDC, ni DNS. `CLAUDE.md:41-43` lo admite. **No
convierte "instalar" en un comando**: hoy no instala nada.

**La asimetría PC/VPS sigue viva y no se arregla sola.** El PC monta `../generated` e importa
(`core/exposure/docker-compose.yml:9-11`, `caddy/Caddyfile:15`); el VPS monta **solo** su Caddyfile
escrito a mano (`docker-compose.finally.yml:15-16`), con los bloques duplicados en
`Caddyfile.finally:30-40` y `:52-67`. Y no puede llegar por git: `.gitignore:5` es
`/core/generated/*`. `tests/test_caddy_finally.py` comprueba invariantes, pero **nada compara los dos
ficheros entre sí**.

---

## El hallazgo que más vale: la identidad llega y se tira

`core/generated/Caddyfile.modules:21` copia al upstream tres cabeceras:

```
copy_headers X-Auth-Request-User X-Auth-Request-Email X-Auth-Request-Preferred-Username
```

(emitidas por `OAUTH2_PROXY_SET_XAUTHREQUEST` en `core/exposure/docker-compose.yml:42`; misma línea
en el VPS, `Caddyfile.finally:59`). Pocket-ID anuncia `sub`, `email` y `preferred_username` en su
discovery.

**Naeth no lee ninguna. Cero coincidencias de `X-Auth-Request` en todo el repo.** Medido en vivo: una
petición a `127.0.0.1:8801/api/status` con `X-Auth-Request-Email: intruso@example.com` inventada
devuelve **200**, sin exigirla, validarla ni registrarla.

Por la vía MCP pasa lo mismo un nivel más abajo: el `AccessToken` que construye el `JWTVerifier`
lleva el payload completo del JWT, `sub` incluido, y `AccessToken` tiene hasta campo propio
(`subject`). Naeth usa `tok` dos veces y ninguna es esa:

```python
mcp_server.py:198   zone = "public" if tok else "loopback"     # solo mira si existe
mcp_server.py:209   "client_id": getattr(tok, "client_id", None) if tok else None
```

⚠ Sin verificar en vivo con un token real emitido: verificada la ruta de código y que el IdP anuncia
`sub`, no interceptado un `claims` de producción.

**El autor tampoco identifica personas.** Las ocho claves del JSONB `author` medidas sobre las 943
filas son `product`, `surface`, `zone`, `actor`, `vendor`, `model`, `model_source`, `client_raw`.
Responde "qué producto, qué superficie, qué modelo", nunca "quién". Las escrituras del visor van con
una constante literal, `_HUMAN_AUTHOR` (`mcp_server.py:142-143`), con el proxy sabiendo
perfectamente quién es.

**Y un problema de diseño que esto destapa**: `naeth-visor.enraxk.dev` y el loopback 8801 son **el
mismo proceso y el mismo puerto** (`Caddyfile.modules:27` apunta a `host.docker.internal:8801`, y el
servicio `viewer` publica `127.0.0.1:8801:8000` con `OAUTH_ENABLED=0`). Hoy el código no puede
distinguir "Eneko autenticado por SSO" de "cualquier cosa que corra en esta máquina".

**El esquema.** El DDL declara **10 tablas de dominio** y 1 vista (`naeth/db/schema.sql`). El "15" de
la medición del 06/09 sale de contar vistas y escombros de migración (`_path_backup`,
`_emdash_backup`, `_map`, `_map2`). Cero `user_id`, `owner`, `tenant_id`, `account_id`, `created_by`.
**Cero `ROW LEVEL SECURITY`** en los dos repos.

**Veredicto**: multi-usuario es **barato en la identidad y caro en los datos**. La identidad ya está
en la petición; lo que falta es dónde meterla y **31 consultas contra `memory`/`memory_current` en
`app/core.py` que hoy no filtran por nadie**, más una migración de columna coordinada entre los dos
nodos del failover (`migrations/006-digest.sql:64` documenta que obliga a ir "`finally` PRIMERO y el
PC después").

---

## Portabilidad: el dato que manda sobre todos los demás

**El repo de CENIT es PRIVADO** (`gh repo view Enraxk/cenit` devuelve `"visibility":"PRIVATE"`).
Naeth es público. Un desconocido no puede obtener la mitad del sistema, y todo lo demás es secundario
a eso.

**No existe camino de instalación.** Seis composes sueltos sin orquestador, red `cenit-net` como
`external: true` creada a mano, cero scripts de bootstrap (los cuatro que suenan a eso son tres
`install-*-hook.ps1` de tareas programadas de Windows y un `ufw-setup.sh`), y cero documentación de
instalación. `docs/README.md` dice explícitamente que el diseño canónico **no vive en el repo**.

**Tres ataduras rompen el arranque**, no son cosméticas:

- `core/exposure/docker-compose.yml:22` monta `C:\Users\eneki\.cloudflared\<uuid>.json`
- `core/exposure/cloudflared/config.host.yml:6` apunta al mismo fichero
- `secrets/load-age-key.ps1:18` hace `throw` si falta `C:\Users\eneki\.cenit\age-key.dpapi`, y **todos**
  los `up.ps1` lo dot-sourcean como primer paso. DPAPI solo descifra con el mismo usuario de Windows
  en la misma máquina. En Linux, `core/lib/sops-env.sh` sourcea `/etc/cenit/load-age-key.sh`, que
  **no está versionado**.

| Patrón | CENIT | Naeth |
|---|---:|---:|
| `enraxk.dev` | 191 | 87 (solo 5 en runtime, casi todo comentarios) |
| Ruta absoluta Windows | 16 en 8 ficheros | 36, **todas en docs** |
| `C:\Users\eneki` | 5 | 3 (solo `.md`) |
| IPs fijas de LAN | 20 | 0 |
| UUIDs de túnel | 13 | 0 |
| Scripts `.ps1` frente a `.sh` | 17 y 10, solo 5 en ambos | n/a |

**Requisitos duros para un tercero**: cuenta de Cloudflare con `zone_id` y túnel (`config.py:64-68`,
campo obligatorio con `extra="forbid"`; y `Caddyfile:6` lleva `auto_https off` porque el TLS lo pone
Cloudflare, así que sin túnel no hay certificado en ningún sitio), dominio propio (agravante:
`config.py:126` documenta que **el hostname del IdP es el rpID de las passkeys**, cambiarlo las
invalida), clave age, Windows para el nodo preferente, y Pocket-ID configurado a mano con una
pescadilla que se muerde la cola: el `api` de Naeth exige `OIDC_CLIENT_ID` y `OIDC_CLIENT_SECRET` con
`:?`, valores que solo existen después de que un humano cree un cliente dentro de un Pocket-ID ya
levantado, que exige el fichero de secretos, que exige la clave age. `pocketid.py` sabe crear
clientes por API, pero nada lo cablea a un primer arranque.

**Naeth, en cambio, está a un compose de ser autónomo.** Cero rutas absolutas en código de runtime.
Lee **una** variable de base de datos (`NAETH_DSN`). `mcp_server.py:84` es `if not OAUTH_ENABLED:` y
salta el IdP entero, que es exactamente lo que ya hace el servicio `viewer` del 8801. Lo que lo ata
está todo en el compose: cinco `${VAR:?}` de fallo duro, `cenit-net` como externa, `NAETH_DSN`
literal apuntando a `modules-db` (7 menciones, 0 definiciones: vive en CENIT), y el `throw` de
`up.ps1` sin `CENIT_PATH`. Verificado ejecutando `docker compose config`, no leyendo.

Lo que Naeth pierde solo: exposición pública, SSO en el visor, OAuth en `/mcp` (o sea claude.ai como
cliente), el Postgres compartido y el failover. **Lo que conserva: todo lo del 8801, las 9 tools, la
recuperación híbrida, el visor, el grafo y el worker.** Para un usuario local, eso es el producto
entero.

---

## Dos riesgos encontrados de rebote, que no eran el encargo

1. ⚠ **`core/config.yaml:143-146` afirma algo falso sobre el sistema.** Dice que el bloque de AMP va
   "DIRECTO, sin forward-auth" y que ponerle oauth2-proxy delante "sería doble autenticación". El
   despliegue real sí lo pone tras `forward_auth oauth2-proxy-amp:4180`
   (`Caddyfile.finally:98-112`), y `test_caddy_finally.py:117-127` lo vigila porque AMP tiene
   licencia Professional y **no puede** hacer OIDC. Si alguien usa la config como fuente de verdad,
   retira el único control que separa ese panel de internet.
2. ⚠ **`core/config.yaml` está commiteado con el despliegue real**: `zone_id` de Cloudflare, dos
   UUIDs de túnel, `ssh: root@192.168.1.60`, tres IPs de LAN y una MAC. Hacer público el repo tal
   cual publica todo eso. No hay ninguna plantilla `.example`.

Menor: `CLAUDE.md:41` de CENIT dice 221 tests; son 261.

---

## La frase que resume el diagnóstico

**Naeth está a un cambio de fichero compose de ser autónomo. CENIT no es una distribución: es el
despliegue de una persona guardado en git.** La separación entre "la plataforma" y "la instancia de
Eneko" no existe hoy, y es exactamente la separación que exige el requisito de que el producto sea el
mismo que él usa.
