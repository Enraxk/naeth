# Tres docstrings para decidir la guía de estilo

**Fecha**: jueves 10/09/2026, 19:36 a 20:15.
**Para qué**: Eneko decidió a las 19:36 que la guía de §2 del
[discovery](../discovery/biblioteca-codigo-2026-09-10.md) se cierra viendo tres funciones reescritas,
no leyendo el borrador. Estas son las tres. **Son propuesta sobre papel: los ficheros no se han tocado**
(editar `naeth/app/` recarga el 8801, y la decisión es suya antes de aplicarla).
**Cómo leer**: por cada función, el docstring que hay, el que se propone, y de dónde sale cada
afirmación del propuesto, con fichero y línea. Nada del "después" está inventado: todo lo que afirma
está en el código, en el compose, en un commit o en un documento, y se cita. Donde un porqué no está
escrito en ningún sitio, se dice que es razón técnica y no decisión registrada.

Las tres se eligieron por lo que cada una prueba de la guía:

| Función | Qué prueba |
|---|---|
| `oauth.login_post` | Documentar desde cero algo sin doc, y además **código que no corre en producción**: qué tiene que decir un docstring para no mentir |
| `mcp_server.memory_search` | Qué va en el docstring cuando la documentación **ya vive en la `description` del decorador** y la lee el agente |
| `core.search` | Qué le cambia la guía a un docstring que **ya es bueno** |

---

## 1. `oauth.login_post` (`naeth/app/oauth.py:242-277`)

### Antes

No tiene docstring. Es una de las 30 funciones de `oauth.py` sin documentar; la única documentada es la
clase (`oauth.py:57`, una línea). El módulo sí tiene cabecera (`oauth.py:1-20`), con el flujo del login
y las notas de seguridad.

### Después

```python
async def login_post(request: Request) -> Response:
    """Segundo paso del login de un usuario: valida el formulario y emite el authorization code.

    Recibe `rid`, `user` y `password` del formulario de `login_get`. Busca el pending que `authorize()`
    dejó con ese `rid`, comprueba las credenciales, guarda un `AuthorizationCode` de cinco minutos en
    `oauth_code`, borra el pending y redirige al `redirect_uri` del cliente con `?code=...&state=...`.
    Devuelve 400 si el `rid` no existe, 401 con el formulario y un error si las credenciales fallan,
    y 303 al `redirect_uri` si todo va bien.

    EL PENDING SE COMPRUEBA ANTES QUE LA CONTRASEÑA, y el orden importa: sin un `rid` vivo, la
    petición muere en el 400 sin llegar a comparar credenciales, así que probar contraseñas exige
    haber pasado antes por `/authorize`. Las credenciales se comparan con `compare_digest` para que
    el tiempo de respuesta no diga cuántos caracteres acertaste (ver la cabecera del módulo).

    El pending se borra al consumirse: reenviar el mismo formulario devuelve 400, y un `code` solo
    puede nacer de un `rid` una vez. El 303 y no 302 es para que el navegador haga GET al
    `redirect_uri` después del POST del formulario, que es lo que espera el cliente OAuth.

    ⚠ ESTE CAMINO NO CORRE EN PRODUCCIÓN desde el cutover a CENIT del 17/07/2026. El proveedor vivo
    es `OIDCProxy` contra Pocket-ID (`OAUTH_PROVIDER=oidc` en el compose), y `NaethOAuthProvider` es
    el rollback de la fase 3b. La ruta `/login` sigue montada en `mcp_server.py` con cualquier
    proveedor, pero con `oidc` nadie crea pendings, así que responde 400 siempre. Si algún día se
    vuelve a este proveedor, revisar antes las notas de seguridad de la cabecera: sin sesión, sin
    CSRF, un solo usuario.

    ⚠ EL MENSAJE DEL 400 DICE "O EXPIRADA", Y NINGÚN PENDING EXPIRA: `oauth_pending` no tiene
    `expires_at` y solo se borra aquí, al consumirse. Un `rid` abandonado vive para siempre. No es
    un agujero mientras el proveedor esté apagado; es una promesa del mensaje que el código no cumple.
    """
```

### De dónde sale cada afirmación

| Afirmación | Evidencia |
|---|---|
| Recibe `rid`, `user`, `password`; busca el pending; 400 si no existe | `oauth.py:243-254` |
| 401 con el formulario y error si fallan credenciales | `oauth.py:256-257`, `_login_html(rid, "Credenciales invalidas.")` |
| Code de cinco minutos | `AUTH_CODE_TTL = 5 * 60`, `oauth.py:42`; `expires_at=time.time() + AUTH_CODE_TTL`, `:264` |
| Guarda en `oauth_code`, borra el pending, redirige 303 con `code` y `state` | `oauth.py:268-277` |
| El pending se comprueba antes que la contraseña | Orden de `oauth.py:248-257`: el `return` del 400 (`:252-254`) precede a `_valid_credentials` (`:256`) |
| `compare_digest` y por qué | `oauth.py:207-211`; cabecera `oauth.py:14-15` "comparadas con compare_digest" |
| Reenviar el formulario devuelve 400 | El `DELETE FROM oauth_pending` de `:273` deja el `rid` sin fila; la segunda petición cae en `:252` |
| 303 y no 302 | **Razón técnica, no decisión registrada**: es la semántica de "See Other" tras un POST. No hay commit ni nota que lo explique. Se dice así para no vestirlo de decisión |
| No corre en producción; proveedor `oidc`; rollback de fase 3b | `docker-compose.yml:57` `OAUTH_PROVIDER: oidc`; `mcp_server.py:86-101` rama `oidc`; `:109-111` "Fase 3b (legacy, rollback)"; `mcp_server.py:126` "tabla oauth_client, MUERTA tras el cutover a CENIT" |
| Cutover del 17/07/2026 | `CLAUDE.md` del repo, "Desde el cutover del 17/07/2026 es el módulo `memory` de CENIT" |
| `/login` montada con cualquier proveedor | `mcp_server.py:459-468`, dos `custom_route("/login")` sin condición sobre `OAUTH_PROVIDER`; el comentario de `:457-458` lo asume: "Inofensivo si OAuth esta off (nadie llega)" |
| Sin sesión, sin CSRF, un usuario | Cabecera `oauth.py:14-16` |
| `oauth_pending` no tiene `expires_at` | `schema.sql`, tabla `oauth_pending`: `id`, `client_id`, `params`, `created_at`. `oauth_code` sí tiene `expires_at` y `oauth_token` también |
| Solo se borra aquí | `grep -n "oauth_pending" naeth/app/*.py`: el INSERT en `authorize()` (`oauth.py:90-95`) y el SELECT y DELETE de `login_post`. Ningún otro DELETE: tres aciertos en total, `oauth.py:91`, `:249` y `:273` |

### Lo que este caso decide de la guía

- **Un docstring puede y debe decir que el código está muerto.** Es la información más valiosa que
  tiene esta función, y no estaba en ningún sitio cerca de ella: estaba en el compose y en un comentario
  de otro fichero.
- **Documentar hace revisar.** El segundo aviso (el "expirada" que no expira) apareció al escribir el
  docstring, no antes. Es exactamente el bucle que se quiere recuperar.
- **Cuando un porqué no está registrado, se dice.** El 303 se explica como razón técnica y no se le
  inventa una historia.

---

## 2. `mcp_server.memory_search` (`naeth/app/mcp_server.py:316-341`)

### Antes

No tiene docstring. Toda la documentación está en la `description` del decorador `@mcp.tool`
(`mcp_server.py:317-335`), 19 líneas escritas **para el agente**: cuándo llamarla, qué filtros hay, que
devuelve digest y no texto, y que hay que seguir con `memory_get`. Es lo que griffe extrae del decorador
(discovery §1.5), así que a efectos de la biblioteca no está sin documentar; está documentada en otro
sitio y para otro lector.

### Después

Se propone **no duplicar la `description`** y darle al docstring lo que la `description` no puede llevar
porque el agente no lo necesita: el porqué, las mediciones y los avisos para quien lo mantiene.

```python
@mcp.tool(name="memory_search",
          description=...)   # sin cambios: es lo que lee el agente
def memory_search(query: str, k: int = 10, path_prefix: str | None = None,
                  tags: list[str] | None = None, memory_type: str | None = None,
                  since: str | None = None) -> list[dict[str, Any]]:
    """La tool de entrada: `core.search` con la consulta embebida, y cada hit recortado a su digest.

    La `description` del decorador es el contrato con el agente y se mantiene ahí; esto es para quien
    mantiene la tool. Hace dos cosas: embebe la consulta con `_embed_query` y pasa los cuatro filtros
    a `core.search`, que los aplica dentro de cada rama; y reduce cada fila a `_hit`, que quita el
    `content` y deja `digest` más `digest_source`.

    POR QUÉ DEVUELVE EL DIGEST Y NO EL TEXTO (fase 4, 28/08/2026): con `k=10` y una media de 2.686
    caracteres por nota, la respuesta pesaba unos 27.000 caracteres; con título y digest, unos 3.800.
    Un 86% menos de contexto por búsqueda, y la búsqueda es la llamada más frecuente. El texto entero
    se pide con `memory_get`, que es lo que la `description` le dice al agente.

    POR QUÉ LOS FILTROS VAN A `core.search` Y NO SE APLICAN AQUÍ: filtrar sobre el resultado dejaría
    las 50 plazas de cada rama ocupadas por lo de siempre y devolvería el mismo ruido con menos filas.
    Dentro de cada rama, las plazas se reparten entre lo que de verdad compite. Ver `core.search`.

    ⚠ SI EL MODELO NO ESTÁ DISPONIBLE, LA BÚSQUEDA CAE A LÉXICA EN SILENCIO: `_embed_query` devuelve
    `None` ante cualquier excepción y `core.search` sigue sin la rama semántica. La ruta `/api/search`
    del visor sí reporta `mode`; esta tool no, así que el agente no puede distinguir una búsqueda
    híbrida de una degradada. Si un día importa, el sitio para decirlo es el dict de `_hit`.

    ⚠ LA RAMA LÉXICA NO TOKENIZA COMO UNO ESPERA: el `tsvector` usa la configuración `simple`, sin
    stemmer y sin stopwords, y un identificador con punto es un solo token. Buscar `execute` no
    encuentra una nota que diga `c.execute(sql)`, y buscar `memory_type` casa con cualquier nota que
    tenga `memory` y `type` en párrafos distintos. Medido el 10/09/2026.

    Args:
        k: tope de resultados, por defecto 10. Las dos ramas internas siguen recogiendo 50 cada una.
        since: fecha ISO; solo memorias creadas después. Los otros tres filtros son evidentes.
    """
```

### De dónde sale cada afirmación

| Afirmación | Evidencia |
|---|---|
| Embebe con `_embed_query` y pasa los filtros | `mcp_server.py:337-340` |
| `_hit` quita `content` | `mcp_server.py:301-313`, docstring de `_hit`: "SIN `content`, que es el cambio de la fase 4" |
| Los filtros van dentro de cada rama | `core.py:311-314` |
| 27.000 a 3.800 caracteres, 86% | `docs/plan/fase-4-0-tope-y-prioridad.md`, "Efecto en contexto" |
| Fase 4, 28/08/2026 | Commit `0c5c342` (28/08) "La búsqueda deja de devolver el texto entero y pasa a devolver el digest"; filtros en `2610fb7` (28/08) |
| Cae a léxica en silencio | `mcp_server.py:117-122`: `except Exception: return None` |
| `/api/search` reporta `mode`; la tool no | `mcp_server.py:538` devuelve `"mode": "hybrid" if q_emb else "lexical"`; `_hit` (`:309-313`) no tiene ese campo |
| `simple`, sin stemmer ni stopwords; un token por identificador con punto | `schema.sql:42-44`; cuaderno fase 1 §1.2.b, medido el 10/09 con `to_tsvector` |
| Las ramas recogen 50 | `core.py:338`, `:350`, `LIMIT 50` |

### Lo que este caso decide de la guía

- **Cuando hay `description` para el agente, el docstring no la repite: la complementa.** Dos lectores,
  dos textos. Griffe extrae los dos, así que la biblioteca los puede enseñar juntos.
- **`Args:` solo para lo no evidente.** Aquí `k` y `since` merecen una línea; `query`, `path_prefix`,
  `tags` y `memory_type` no. Es la opción 1 de la pregunta de las 19:36 aplicada.
- **Un aviso puede ser una limitación conocida sin arreglo**, dicha con el dónde se arreglaría.

---

## 3. `core.search` (`naeth/app/core.py:305-358`)

### Antes

Ya tiene un docstring bueno (`core.py:308-321`, volcado en el discovery): primera frase, el bloque en
mayúsculas de los filtros dentro de cada rama, y el bloque del `is_current` con la medición del 28/08
(40 de 297 pares correctivos). Es del estilo que la guía destila.

### Después

Cambia poco, y lo que cambia es para cumplir la guía entera: la primera línea dice qué devuelve, se
añade lo que la función **no** hace, y un aviso sobre cómo leer `score`.

```python
def search(query: str, *, k: int = 10, q_embedding: list[float] | None = None,
           path_prefix: str | None = None, tags: list[str] | None = None,
           memory_type: str | None = None, since: str | None = None) -> list[dict]:
    """Búsqueda híbrida RRF sobre lo vigente: filas enteras de `memory_current` con un `score`.

    Dos ramas de 50 candidatos, semántica por coseno y léxica por `ts_rank`, fundidas por
    Reciprocal Rank Fusion con la misma constante 60 en las dos. Si `q_embedding` es `None`, solo
    corre la léxica: es lo que pasa antes de tener modelo, y lo que pasa cuando `_embed_query` falla.

    LOS FILTROS SE APLICAN DENTRO DE CADA RAMA, no sobre el resultado, y esa es toda la diferencia
    entre mejorar el recall y solo recortar la salida: filtrando después, las 50 plazas de `sem` y de
    `txt` ya se las ha llevado lo de siempre, y lo que queda es el mismo ruido con menos filas.
    Filtrando dentro, esas 50 plazas se reparten entre lo que de verdad compite.

    NO HAY FILTRO DE `is_current`: la búsqueda va sobre la vista `memory_current` a propósito.
    Medido el 28/08/2026, 40 de los 297 pares de supersession son CORRECTIVOS (el hijo desmiente algo
    del padre), así que abrir la búsqueda al histórico devolvería afirmaciones ya refutadas sin su
    corrección al lado. El histórico se alcanza por `get`, que marca `is_current` y trae la cadena.

    LO QUE ESTO NO HACE: excluir. Los cuatro filtros son positivos; no hay forma de pedir "todo menos
    este path". Quien necesite un espacio aparte tiene que dárselo por `path_prefix` en cada llamada,
    o cambiar esta función. Anotado el 10/09/2026 al estudiar meter código en el corpus.

    ⚠ `score` ES UNA SUMA DE RANGOS, NO UNA SIMILITUD: vale `1/(60+r_sem) + 1/(60+r_txt)`, así que
    el máximo teórico es 2/61 y una nota que solo aparece en una rama nunca pasa de 1/61. Sirve para
    ordenar dentro de una consulta y para nada más: no se compara entre consultas ni se convierte en
    porcentaje. Para similitud de verdad está `graph_knn`.

    Args:
        q_embedding: vector de la consulta, del mismo modelo y dimensión que la columna; `None`
            desactiva la rama semántica.
        k: filas devueltas tras fundir. No cambia el 50 de cada rama.
    """
```

### De dónde sale cada afirmación

| Afirmación | Evidencia |
|---|---|
| Filas enteras con `score` | `core.py:351` `SELECT m.*, (...) AS score` |
| Dos ramas de 50, coseno y `ts_rank`, constante 60 | `core.py:335-350`, `:351` |
| `None` cuando `_embed_query` falla | `mcp_server.py:117-122` |
| Los dos bloques en mayúsculas | Texto actual de `core.py:311-321`, conservado |
| No hay filtro negativo | `_filtros`, `core.py:278-302`: solo `LIKE`, `@>`, `=`, `>=`; cuaderno fase 1 §1.2.e |
| Máximo `2/61`, una rama `1/61` | Aritmética de la fórmula de `core.py:351` con `r=1` |
| `graph_knn` para similitud | `core.py:468-485` |

### Lo que este caso decide de la guía

- **Un docstring bueno casi no cambia.** La guía no reescribe lo que ya cumple; añade la primera línea
  con el retorno, el "lo que esto no hace" y el aviso de lectura.
- **"Lo que esto NO hace" es una sección con derecho propio.** Aparece ya en `_retry_discovery`
  (`mcp_server.py:57`, "LO QUE ESTO **NO** HACE, y es deliberado") y en `readonly_sql` de CENIT. Merece
  estar en la guía como pieza octava.

---

## 4. Lo que hay que decidir viendo esto

1. **¿Es este el tono?** Los tres siguen las siete piezas del borrador más la octava ("lo que esto no
   hace"). Si algo sobra o falta, es el momento.
2. **`Args:` solo cuando hace falta, o siempre.** Aquí va solo donde un parámetro no es evidente. El
   caso 2 enseña cómo queda.
3. **Tildes.** Los tres van con tildes. El `naeth/app` de hoy no las lleva (`core.py`, `worker.py`,
   `mcp_server.py`: "busqueda", "proposito", "aqui"); `cenit_core` sí. Si la guía dice tildes, los
   docstrings viejos de Naeth se irán corrigiendo al tocarlos, no de golpe.
4. **Longitud.** El de `login_post` tiene 27 líneas para una función de 36. Es lo que cuesta decir la
   verdad de un camino muerto; un docstring más largo que la función no es un defecto cuando la
   información no vive en otro sitio.
5. **Cuando la doc del agente y la del mantenedor se separan** (caso 2), ¿la biblioteca enseña las dos,
   una encima de otra? Griffe da las dos; es una decisión de la vista, no del código.

Si estos tres valen, la guía se cierra con ellos como ejemplos canónicos, va a `CLAUDE.md` global, y
la fase 2 empieza por aplicarlos a los ficheros en un solo despliegue del 8801.
