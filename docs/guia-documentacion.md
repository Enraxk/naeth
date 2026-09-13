# Guía de documentación de código

**Cerrada el 10/09/2026 a las 20:26**, después de ver el
[espectro de estilos](plan/biblioteca-codigo-espectro-estilos-2026-09-10.md) sobre dos funciones
reales y las [tres reescrituras](plan/biblioteca-codigo-tres-docstrings-2026-09-10.md). Se actualiza,
no se archiva. El resumen operativo vive en el `CLAUDE.md` global, porque una regla de escritura que
solo está en un repo no se consulta al escribir; aquí está la versión larga y los ejemplos canónicos.
**Vale para todos los repos**: Naeth, CENIT, Yogin, GridWatch.

## 1. Qué se documenta

- **Todo símbolo público con más de cinco líneas** lleva Doc: función, método, clase. Es también el
  filtro de entrada de la biblioteca de código (discovery del 10/09, §4): lo que tiene Doc y pasa de
  cinco líneas entra; lo demás no.
- **Todo fichero lleva cabecera**: en Python el docstring de módulo, en JavaScript y TypeScript un
  bloque `@fileoverview` con `@module`. Dice qué hay en el fichero y qué reglas viven ahí y en ningún
  otro sitio. Es el nivel que GridWatch tenía en 2025 y Naeth no.
- **Con Doc, no con comentarios**: en Python el docstring dentro, primera sentencia del cuerpo; en JS,
  TS, Java, C# y C++ el bloque encima, `/** */` o `///`. Un comentario `#` o `//` encima de una función
  no lo ve `help()`, ni el linter, ni el generador, ni la biblioteca. Los comentarios `//` narrativos
  de Yogin son buenos y hay que meterlos en `/** */`, no borrarlos.

## 2. La forma: Google, con la narrativa en `Notes:` al final

Sintaxis Google (`Args:`, `Returns:`, `Raises:`, `Example:`, `Notes:`), validable con ruff
(`convention = "google"`, reglas `D1xx` y `D4xx`) y parseable por griffe, mkdocstrings y pdoc.
Orden de un docstring completo:

1. **Resumen en una línea**: qué hace y qué devuelve. Verbo en presente, sin "esta función".
2. **Un párrafo de contexto** si el resumen no basta: el mecanismo en dos o tres frases.
3. **`Args:`** solo cuando algún parámetro no se explica por la firma, **y entonces con todos los
   parámetros**, aunque los evidentes lleven media línea. La sección es todo o nada: ruff `D417`
   avisa de cualquier parámetro que falte en una `Args:` que exista (medido el 13/09/2026 al
   documentar `oauth.py`). Los tipos van en la firma, no aquí.
4. **`Returns:`** qué devuelve y qué devuelve cuando no hay nada. **`Raises:`** solo lo que el que
   llama tiene que manejar.
5. **`Example:`** obligatorio en utilidades puras (sin base de datos, red ni reloj), con `>>>` y
   ejecutable por doctest. En rutas, tools y servicios no se exige: un ejemplo que no corre es peor
   que ninguno.
6. **`Notes:`** al final, con la narrativa. Es la sección que distingue esta guía de un docstring de
   manual, y lleva, en este orden y solo las que existan:
   - **El porqué**: por qué así y no de otra forma.
   - **La alternativa descartada**, y qué pasaría con ella.
   - **El incidente con fecha**, si lo hubo: "fallo real, 26/07/2026".
   - **El número medido con fecha**: "medido el 04/09/2026: 5,1 ms".
   - **Lo que esto NO hace**, cuando alguien podría suponer que sí.
   - **El aviso**, con `⚠` y en MAYÚSCULAS lo que no se debe tocar.
   - **La referencia cruzada** a la función, nota de Naeth o documento que completa la historia.
7. **Cuando un porqué no está registrado en ningún sitio, se dice** ("razón técnica, no decisión
   registrada"). No se le inventa una historia.

**En JavaScript y TypeScript el orden lo fuerza la sintaxis**: JSDoc toma como descripción todo lo
que va antes de la primera etiqueta, así que la narrativa va después del resumen y antes de
`@param`. Mismo contenido, otro orden. En TypeScript la narrativa va bajo `@remarks`. Los tipos van
entre llaves en JavaScript (`{string[]}`) y no van en TypeScript.

## 3. Voz

- **Identificadores en inglés, prosa en castellano** (decidido el 13/09/2026, leyendo `oauth.py`
  y `mcp_server.py`). Identificadores son variables, funciones, clases, parámetros, columnas,
  claves JSON, nombres de fichero y rutas; prosa son docstrings, comentarios, mensajes al usuario
  y líneas de log. Hasta ese día no había regla y el código la decidió solo: la superficie pública
  ya estaba en inglés (`memory_search`, `content_hash`, `digest_source`) y lo interno en castellano
  (`espera`, `cadena`, `hoja`, `era_mirror`), y el visor entero (`pintor.ts`, `Lienzo.svelte`,
  las vistas `Ajustes` y `Memoria`). Dos razones: el símbolo es por lo que se busca en CodeDoc
  Archive, y `chain` no encuentra `cadena`; y en cualquier equipo de backend los nombres van en
  inglés y la prosa en el idioma del equipo. **Lo viejo se renombra al tocarlo**, no en una
  pasada: los locales de `core.py` y `mcp_server.py` son baratos y los cubre la suite. ⚠ El
  visor es otra escala, porque sus nombres son ficheros, vistas y rutas que se ven: cuándo y cómo
  se renombra se decide aparte, no cae bajo "al tocarlo".
- **Castellano con tildes**, salvo en repos que ya están en inglés (GridWatch). Los docstrings viejos
  de `naeth/app` sin tildes se corrigen cuando se toque esa función, no en una pasada aparte.
- Mayúsculas para la palabra que carga la frase, no para gritar. La conclusión primero ("NO ES
  OPCIONAL, y es el fallo más caro de 8.3"). El precio de la decisión, dicho ("el precio es que una
  petición en vuelo puede fallar").
- Nada de cajas de guiones ni ASCII art: un generador las pinta tal cual.
- Cero em dash, como en todo lo demás.

## 4. Lo que documentar hace, y por eso se hace

Al escribir el docstring de `login_post` el 10/09 aparecieron dos cosas que no estaban en ningún
sitio: que el camino no corre en producción desde el cutover, y que su mensaje de error promete una
caducidad que el código no cumple. **Documentar es revisar.** El docstring es el sitio donde se
descubre que el código miente, y por eso lo escribe quien acaba de tocar el código, en el mismo
turno, y no una pasada de documentación después.

## 5. Ejemplos canónicos

Cuatro en Python y uno en JavaScript, en la forma final. Los de Python son propuestas sobre los
ficheros de `naeth/app`, no aplicadas todavía; se aplican en un solo despliegue del 8801.

### 5.1 `worker.claim_batch`: mecanismo, incidente y aviso

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos, y devuelve sus filas.

    Un job es huérfano si lleva más de `LEASE_MINUTES` en 'processing'. El `SKIP LOCKED` deja
    que varios workers reclamen a la vez sin pisarse, y el `ORDER BY id` saca antes los más
    antiguos.

    Args:
        c: conexión psycopg abierta, en transacción escribible.
        n: tope de jobs a reclamar. `process_once` pasa `BATCH`.

    Returns:
        Las filas reclamadas, con `id` y `memory_id`. Vacía si no hay nada.

    Notes:
        POR QUÉ EL LEASE (fallo real, 26/07/2026): esto solo reclamaba `status='pending'`. Si
        el worker moría a mitad (reinicio del PC, de Docker, un apagón) el job se quedaba en
        'processing' para siempre y su memoria nunca recibía embedding. El síntoma es de los
        peores que puede tener un sistema de memoria: la nota está, se lee, se encuentra por
        texto, y NO aparece en la búsqueda semántica. En silencio. Se detectaron dos así, del
        8 y el 11 de julio, 18 días después y de casualidad.

        Ahora un job en 'processing' más viejo que el lease se vuelve a reclamar, `attempts`
        sube en cada intento, y al llegar a `MAX_ATTEMPTS` lo retira `reap_dead_jobs`.

        ⚠ ESCRIBE AUNQUE NO HAYA NADA QUE RECLAMAR: es un UPDATE, y en el nodo que no lidera
        el rol es read-only. `process_once` pregunta `is_mirror` antes de llamar aquí; no lo
        llames por tu cuenta sin esa comprobación.
    """
```

### 5.2 `oauth.login_post`: código que no corre en producción

```python
async def login_post(request: Request) -> Response:
    """Segundo paso del login de un usuario: valida el formulario y emite el authorization code.

    Busca el pending que `authorize()` dejó con el `rid` del formulario, comprueba las
    credenciales, guarda un `AuthorizationCode` de cinco minutos en `oauth_code`, borra el
    pending y redirige al `redirect_uri` del cliente.

    Args:
        request: la petición del formulario, con `rid`, `user` y `password` en el cuerpo.

    Returns:
        303 al `redirect_uri` con `code` y `state` si todo va bien; 400 si el `rid` no existe;
        401 con el formulario y un error si las credenciales fallan.

    Notes:
        EL PENDING SE COMPRUEBA ANTES QUE LA CONTRASEÑA, y el orden importa: sin un `rid` vivo
        la petición muere en el 400 sin llegar a comparar credenciales, así que probar
        contraseñas exige haber pasado antes por `/authorize`. Las credenciales se comparan
        con `compare_digest` para que el tiempo de respuesta no diga cuántos caracteres
        acertaste (ver la cabecera del módulo).

        El pending se borra al consumirse: reenviar el mismo formulario devuelve 400, y un
        `code` solo puede nacer de un `rid` una vez. El 303 y no 302 es para que el navegador
        haga GET al `redirect_uri` tras el POST: razón técnica, no decisión registrada.

        ⚠ ESTE CAMINO NO CORRE EN PRODUCCIÓN desde el cutover a CENIT del 17/07/2026. El
        proveedor vivo es `OIDCProxy` contra Pocket-ID (`OAUTH_PROVIDER=oidc` en el compose) y
        `NaethOAuthProvider` es el rollback de la fase 3b. La ruta `/login` sigue montada en
        `mcp_server.py` con cualquier proveedor, pero con `oidc` nadie crea pendings, así que
        responde 400 siempre.

        ⚠ EL MENSAJE DEL 400 DICE "O EXPIRADA", Y NINGÚN PENDING EXPIRA: `oauth_pending` no
        tiene `expires_at` y solo se borra aquí. Un `rid` abandonado vive para siempre. No es
        un agujero con el proveedor apagado; es una promesa del mensaje que el código no cumple.
    """
```

### 5.3 `mcp_server.memory_search`: cuando la doc del agente ya vive en el decorador

```python
@mcp.tool(name="memory_search",
          description=...)   # sin cambios: es el contrato con el agente
def memory_search(query: str, k: int = 10, path_prefix: str | None = None,
                  tags: list[str] | None = None, memory_type: str | None = None,
                  since: str | None = None) -> list[dict[str, Any]]:
    """La tool de entrada: `core.search` con la consulta embebida, y cada hit recortado a su digest.

    La `description` del decorador es lo que lee el agente y se mantiene ahí; esto es para quien
    mantiene la tool. Embebe la consulta con `_embed_query`, pasa los cuatro filtros a
    `core.search`, y reduce cada fila con `_hit`, que quita `content` y deja `digest` más
    `digest_source`.

    Args:
        query: texto de la consulta; se embebe y se pasa tal cual a la rama léxica.
        k: tope de resultados. Las dos ramas internas siguen recogiendo 50 cada una.
        path_prefix: acota por prefijo de `path`, dentro de cada rama.
        tags: la nota tiene que llevar todos.
        memory_type: uno de los cuatro del vocabulario.
        since: fecha ISO; solo memorias creadas después.

    Returns:
        Lista de hits sin `content`, ordenados por score RRF.

    Notes:
        POR QUÉ DEVUELVE EL DIGEST Y NO EL TEXTO (fase 4, 28/08/2026): con `k=10` y una media
        de 2.686 caracteres por nota, la respuesta pesaba unos 27.000 caracteres; con título y
        digest, unos 3.800. Un 86% menos de contexto en la llamada más frecuente.

        Los filtros van a `core.search` y no se aplican aquí porque filtrar sobre el resultado
        dejaría las 50 plazas de cada rama ocupadas por lo de siempre. Ver `core.search`.

        ⚠ SI EL MODELO NO ESTÁ DISPONIBLE, LA BÚSQUEDA CAE A LÉXICA EN SILENCIO: `_embed_query`
        devuelve `None` ante cualquier excepción. La ruta `/api/search` del visor sí reporta
        `mode`; esta tool no, así que el agente no distingue una búsqueda híbrida de una
        degradada. Si un día importa, el sitio es el dict de `_hit`.

        ⚠ LA RAMA LÉXICA NO TOKENIZA COMO UNO ESPERA: `tsvector` con configuración `simple`,
        sin stemmer ni stopwords, y un identificador con punto es un solo token. Buscar
        `execute` no encuentra `c.execute(sql)`. Medido el 10/09/2026.
    """
```

### 5.4 `core.search`: un docstring que ya era bueno

```python
def search(query: str, *, k: int = 10, q_embedding: list[float] | None = None,
           path_prefix: str | None = None, tags: list[str] | None = None,
           memory_type: str | None = None, since: str | None = None) -> list[dict]:
    """Búsqueda híbrida RRF sobre lo vigente: filas enteras de `memory_current` con un `score`.

    Dos ramas de 50 candidatos, semántica por coseno y léxica por `ts_rank`, fundidas por
    Reciprocal Rank Fusion con la misma constante 60 en las dos.

    Args:
        query: texto para la rama léxica (`plainto_tsquery`, configuración `simple`).
        k: filas devueltas tras fundir. No cambia el 50 de cada rama.
        q_embedding: vector de la consulta, del mismo modelo y dimensión que la columna. `None`
            desactiva la rama semántica: es lo que pasa antes de tener modelo y cuando
            `_embed_query` falla.
        path_prefix: prefijo de `path`, con los comodines de LIKE escapados.
        tags: la nota tiene que llevar todos (`@>`), no alguno.
        memory_type: igualdad exacta.
        since: `created_at` posterior a esta fecha ISO.

    Returns:
        Filas de `memory_current` con una columna `score` añadida, de mayor a menor.

    Notes:
        LOS FILTROS SE APLICAN DENTRO DE CADA RAMA, no sobre el resultado, y esa es toda la
        diferencia entre mejorar el recall y solo recortar la salida: filtrando después, las 50
        plazas de `sem` y de `txt` ya se las ha llevado lo de siempre. Filtrando dentro, esas
        plazas se reparten entre lo que de verdad compite.

        NO HAY FILTRO DE `is_current`: la búsqueda va sobre la vista `memory_current` a
        propósito. Medido el 28/08/2026, 40 de los 297 pares de supersession son CORRECTIVOS,
        así que abrir la búsqueda al histórico devolvería afirmaciones ya refutadas sin su
        corrección al lado. El histórico se alcanza por `get`.

        LO QUE ESTO NO HACE: excluir. Los cuatro filtros son positivos; no hay forma de pedir
        "todo menos este path". Anotado el 10/09/2026 al estudiar meter código en el corpus.

        ⚠ `score` ES UNA SUMA DE RANGOS, NO UNA SIMILITUD: vale `1/(60+r_sem) + 1/(60+r_txt)`,
        máximo 2/61, y una nota que solo aparece en una rama nunca pasa de 1/61. Ordena dentro
        de una consulta y nada más. Para similitud de verdad está `graph_knn`.
    """
```

### 5.5 Yogin, `email-utils.mjs`: cabecera de fichero y una utilidad pura con ejemplo

```js
/**
 * @fileoverview
 * Utilidades de correo de Yogin-API: qué es un correo válido, cuál es un marcador
 * temporal (`@temp.com`), y cómo se dejan las listas de aviso antes de guardarlas.
 *
 * Reglas que viven aquí y en ningún otro sitio:
 * - Un correo se compara siempre normalizado (minúsculas, sin espacios).
 * - Una lista de aviso tiene como máximo `MAX_NOTIFICATION_EMAILS` direcciones.
 * - Quien ya recibe el correo principal no recibe copia (`destinatariosDeCopia`).
 *
 * @module utils/email-utils
 */

/**
 * Deja la lista de correos de aviso como se va a guardar: normalizada, sin duplicados,
 * sin basura y recortada al tope.
 *
 * Se normaliza AQUÍ y no solo en el modelo porque hace falta comparar unas con otras para
 * deduplicar, y "Hola@X.com" y "hola@x.com" son la misma dirección. El `lowercase` del
 * schema llega tarde para eso.
 *
 * LO QUE ESTO NO HACE: rechazar. Una entrada que no es array, un correo sin forma o uno no
 * entregable se descartan sin error, porque la lista es opcional y un correo malo no debe
 * impedir guardar el resto.
 *
 * @param {unknown} valor - Lo que llegue del cliente.
 * @returns {string[]} Como máximo `MAX_NOTIFICATION_EMAILS`, únicos y en minúsculas.
 * @example
 * normalizeNotificationEmails(["Hola@X.com", "hola@x.com", "basura"]); // ["hola@x.com"]
 */
export const normalizeNotificationEmails = (valor) => {
```

## 6. Lo mecanizable, y lo que no

| Qué | Cómo | Estado |
|---|---|---|
| Que exista docstring en módulo, clase y función pública | ruff `D100` a `D103` en `py-lint.ps1` (Naeth y CENIT, cada repo con su copia) | **En aviso desde el 13/09/2026**: el hook mete el recuento y las líneas en el contexto sin bloquear. Pasa a bloqueo cuando los dos árboles estén a cero. `naeth/app` llegó a cero el 13/09; `cenit_core` tiene 54 |
| Que `Args:` cubra todos los parámetros | ruff `D417` con `convention = "google"` | En aviso, en el mismo hook. Es la regla que hace que `Args:` sea todo o nada |
| Que exista JSDoc en funciones exportadas | `eslint-plugin-jsdoc`, regla `require-jsdoc` | En `warn` en Yogin-API (55 avisos) y Yogin-Website (255) desde el 13/09/2026, con el fixer apagado. No en el visor de Naeth todavía |
| Que el `Example:` corra | `pytest --doctest-modules app` en el servicio `test` del compose | **Cableado el 13/09/2026**: cuatro doctests en la suite (76 en total). ⚠ Con `app/tests` y `app` como dos argumentos pytest no recogía ninguno; va `app` solo |
| Que `Notes:` cuente el porqué | Nadie: es revisión | El hook de `Stop` del plan pide la revisión al cerrar un turno con código |
