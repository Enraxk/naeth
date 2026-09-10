# El espectro de estilos de documentación, sobre dos funciones tuyas

**Fecha**: jueves 10/09/2026, 19:58.
**Para qué**: elegir el estilo viendo todo el abanico sobre código real, no sobre un ejemplo de manual.
Complementa [`biblioteca-codigo-tres-docstrings-2026-09-10.md`](biblioteca-codigo-tres-docstrings-2026-09-10.md),
que solo enseñaba el estilo narrativo y el híbrido.
**Las dos funciones**: `claim_batch` de `naeth/app/worker.py:61-91`, que tiene parámetros, retorno, un
incidente real y un mecanismo (el lease); y `normalizeNotificationEmails` de
`Yogin-API/src/utils/email-utils.mjs:59-78`, que hoy lleva un comentario tuyo en `//` que ninguna
herramienta extrae.
**Cómo leer**: cada estilo va con el mismo contenido de fondo, para que lo que cambie sea la forma.
Todo lo que afirman los ejemplos está en el código: `LEASE_MINUTES = 15` (`worker.py:22`),
`MAX_ATTEMPTS = 5` (`:25`), `FOR UPDATE SKIP LOCKED` (`:88`), `RETURNING id, memory_id` (`:89`), y el
incidente del 26/07 con las dos notas del 8 y el 11 de julio (`:64-72`). Ningún ejemplo inventa nada.
Los ficheros no se tocan.

---

## Parte A · Python: `claim_batch`, diez formas

### A1 · Una línea (PEP 257 mínimo)

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos, y los devuelve."""
```

Lo que da: pasa el linter, `help()` dice algo, la biblioteca tiene una frase. Lo que pierde: todo el
porqué. Es el estilo de una función trivial, no de esta.

### A2 · PEP 257 clásico: resumen y párrafo libre

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos, y los devuelve.

    Un job cuenta como huérfano si lleva más de quince minutos en 'processing': se
    asume que el worker que lo cogió murió. Cada reclamación sube `attempts`, y al
    llegar a cinco `reap_dead_jobs` lo marca 'error'. Devuelve las filas reclamadas
    con `id` y `memory_id`.
    """
```

Lo que da: el qué y el mecanismo en prosa, sin etiquetas. Es lo que la mayoría de la stdlib de Python
hace. Lo que pierde: el incidente y la alternativa descartada, y ninguna herramienta puede separar
parámetros de retorno.

### A3 · Google style

Es el más extendido en empresas que escriben Python de backend. Ruff lo valida con
`pydocstyle.convention = "google"` (reglas `D4xx`, por ejemplo D417 avisa si falta un parámetro).

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos.

    Un job es huérfano si lleva más de `LEASE_MINUTES` en 'processing': el worker que
    lo cogió murió a mitad. Se reclama de nuevo y `attempts` sube; al llegar a
    `MAX_ATTEMPTS`, `reap_dead_jobs` lo marca 'error'.

    Args:
        c: Conexión psycopg abierta, dentro de una transacción escribible.
        n: Tope de jobs a reclamar en esta llamada.

    Returns:
        Las filas reclamadas, cada una con `id` y `memory_id`. Vacía si no hay nada.

    Raises:
        psycopg.errors.ReadOnlySqlTransaction: si el nodo no lidera. `process_once`
            lo evita preguntando antes con `is_mirror`.
    """
```

### A4 · NumPy style

El de la ciencia de datos (NumPy, pandas, scikit-learn). Mismo contenido que Google, con secciones
subrayadas y los tipos en la sección aunque estén en la firma. Ruff: `convention = "numpy"`.

```python
def claim_batch(c, n: int) -> list[dict]:
    """
    Reclama hasta `n` jobs de embedding, pendientes o huérfanos.

    Un job es huérfano si lleva más de `LEASE_MINUTES` en 'processing'. Se reclama
    de nuevo y `attempts` sube; al llegar a `MAX_ATTEMPTS` lo retira `reap_dead_jobs`.

    Parameters
    ----------
    c : psycopg.Connection
        Conexión abierta, en transacción escribible.
    n : int
        Tope de jobs a reclamar.

    Returns
    -------
    list of dict
        Filas reclamadas con `id` y `memory_id`. Vacía si no hay nada.

    Raises
    ------
    psycopg.errors.ReadOnlySqlTransaction
        Si el nodo no lidera. `process_once` lo evita con `is_mirror`.

    See Also
    --------
    reap_dead_jobs : retira los jobs que agotaron los intentos.
    """
```

### A5 · reStructuredText, el de Sphinx

El más viejo, el de Django y de mucha librería de 2010 a 2018. Sphinx lo renderiza de serie; los
otros dos necesitan la extensión `napoleon`. Es el más denso de leer en crudo.

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos.

    Un job es huérfano si lleva más de ``LEASE_MINUTES`` en ``processing``.

    :param c: conexión psycopg abierta, en transacción escribible.
    :type c: psycopg.Connection
    :param n: tope de jobs a reclamar.
    :returns: filas reclamadas con ``id`` y ``memory_id``.
    :rtype: list[dict]
    :raises psycopg.errors.ReadOnlySqlTransaction: si el nodo no lidera.
    .. seealso:: :func:`reap_dead_jobs`
    """
```

### A6 · Epytext, el Javadoc de Python

Es lo más parecido a tu ejemplo de Java, con `@param` y `@return`. Existe (Epydoc, 2003) y hoy casi
nadie lo usa; ningún linter moderno lo valida. Va aquí para que veas que la forma Javadoc en Python es
una rareza, no una opción.

```python
def claim_batch(c, n: int) -> list[dict]:
    """
    Reclama hasta C{n} jobs de embedding, pendientes o huérfanos.

    @param c: conexión psycopg abierta.
    @type c: psycopg.Connection
    @param n: tope de jobs a reclamar.
    @return: filas reclamadas con C{id} y C{memory_id}.
    @rtype: list[dict]
    @raise ReadOnlySqlTransaction: si el nodo no lidera.
    """
```

### A7 · Narrativo, el tuyo de hoy (`worker.py:62-78`, tal cual)

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs: los pendientes y los HUERFANOS.

    ── POR QUE EL LEASE (fallo real, 2026-07-26) ──────────────────────────────
    Esto solo reclamaba `status='pending'`. Si el worker moria a mitad -- reinicio
    del PC, de Docker, un apagon -- el job se quedaba en 'processing' PARA SIEMPRE
    y su memoria nunca recibia embedding.

    El sintoma es de los peores que puede tener un sistema de memoria: la nota
    esta, se lee, se encuentra por texto... y NO aparece en la busqueda semantica.
    En silencio, sin un error en ningun log. Se detectaron dos asi, del 8 y el 11
    de julio, descubiertas 18 dias despues y de pura casualidad.

    Ahora un job en 'processing' mas viejo que el lease se vuelve a reclamar.
    `attempts` sigue subiendo en cada intento, y al llegar al tope
    `reap_dead_jobs` lo marca 'error' en vez de dejarlo dando vueltas.
    ───────────────────────────────────────────────────────────────────────────
    """
```

Lo que da: el porqué, el incidente, la consecuencia. Es el único de los diez que un entrevistador
recordaría. Lo que pierde: ninguna herramienta sabe qué devuelve ni qué es `c`; el `SKIP LOCKED` y el
orden por `id` no se mencionan; y las rayas de la caja son ASCII art que un generador pinta tal cual.

### A8 · Híbrido: narrativa primero, secciones Google después (la propuesta de esta tarde)

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos, y devuelve sus filas.

    Un job es huérfano si lleva más de `LEASE_MINUTES` en 'processing'. El `SKIP LOCKED`
    deja que varios workers reclamen a la vez sin pisarse, y el `ORDER BY id` hace que
    los más antiguos salgan primero.

    POR QUÉ EL LEASE (fallo real, 26/07/2026): esto solo reclamaba `status='pending'`.
    Si el worker moría a mitad (reinicio del PC, de Docker, un apagón) el job se
    quedaba en 'processing' para siempre y su memoria nunca recibía embedding. El
    síntoma es de los peores que puede tener un sistema de memoria: la nota está, se
    lee, se encuentra por texto, y NO aparece en la búsqueda semántica. En silencio.
    Se detectaron dos así, del 8 y el 11 de julio, 18 días después y de casualidad.

    Ahora un job en 'processing' más viejo que el lease se vuelve a reclamar, `attempts`
    sube en cada intento, y al llegar a `MAX_ATTEMPTS` lo retira `reap_dead_jobs`.

    ⚠ ESCRIBE AUNQUE NO HAYA NADA QUE RECLAMAR: es un UPDATE, y en el nodo que no
    lidera el rol es read-only. `process_once` pregunta `is_mirror` antes de llamar
    aquí; no lo llames por tu cuenta sin esa comprobación.

    Args:
        c: conexión psycopg abierta, en transacción escribible.
        n: tope de jobs a reclamar. `process_once` pasa `BATCH`.

    Returns:
        Las filas reclamadas, con `id` y `memory_id`. Vacía si no hay nada.
    """
```

Lo que da: todo lo de A7 más lo de A3, y ruff lo puede validar. Lo que cuesta: es el más largo.

### A9 · Tutorial, con ejemplo ejecutable

El estilo de las librerías que se aprenden leyendo la doc (requests, httpx). El `Example` con `>>>`
lo ejecuta `doctest`, así que el ejemplo no puede quedarse viejo sin que un test lo diga.

```python
def claim_batch(c, n: int) -> list[dict]:
    """Reclama hasta `n` jobs de embedding, pendientes o huérfanos.

    Example:
        Reclamar un lote y procesarlo:

        >>> with conn() as c:
        ...     for job in claim_batch(c, 32):
        ...         embed_and_store(c, job["memory_id"])

        Un job que lleve más de quince minutos en 'processing' vuelve a salir aquí,
        porque se asume que su worker murió.

    Args:
        c: conexión psycopg abierta, en transacción escribible.
        n: tope de jobs a reclamar.

    Returns:
        Filas con `id` y `memory_id`.
    """
```

Lo que da: se entiende usándola. Lo que cuesta: escribir un ejemplo que corra de verdad exige un
fixture, y aquí `embed_and_store` no existe con ese nombre: un ejemplo inventado es peor que ninguno.

### A10 · Encima, con `#` (el contraejemplo)

```python
# Reclama hasta n jobs: los pendientes y los huérfanos. Un job es huérfano si
# lleva más de LEASE_MINUTES en 'processing'. Ver el incidente del 26/07.
def claim_batch(c, n: int) -> list[dict]:
    return c.execute(...)
```

Es lo que Yogin hace hoy en JavaScript con `//`. En Python, `help(claim_batch)` devuelve `None`,
`ruff D103` lo marca como sin documentar, y griffe no lo ve. Para la biblioteca es como si no
existiera. Va aquí para que la comparación sea justa: es la forma que hay que abandonar en JS, y en
Python ni siquiera es una opción.

---

## Parte B · JavaScript: `normalizeNotificationEmails`, seis formas

### B0 · Tal cual hoy (`email-utils.mjs:59-64`)

```js
// Deja la lista como se va a guardar: normalizada, sin duplicados, sin basura y
// recortada al tope.
//
// Se normaliza AQUÍ y no solo en el modelo porque hace falta comparar unas con
// otras para deduplicar, y "Hola@X.com" y "hola@x.com" son la misma dirección.
// El `lowercase` del schema llega tarde para eso.
export const normalizeNotificationEmails = (valor) => {
```

Es exactamente tu estilo narrativo, con el porqué y la alternativa descartada. Y está en `//`, así
que JSDoc, TypeDoc, el editor y la biblioteca no lo ven. El contenido es bueno; el envoltorio es el
problema. Es el caso de Yogin entero: 5 bloques `/** */` en todo `src`.

### B1 · JSDoc mínimo

```js
/** Normaliza, deduplica y recorta al tope una lista de correos de aviso. */
export const normalizeNotificationEmails = (valor) => {
```

### B2 · JSDoc completo, el Javadoc de tu ejemplo

Los tipos van entre llaves porque JavaScript no los tiene en la firma. El editor los usa para
autocompletar y avisar.

```js
/**
 * Deja la lista de correos de aviso como se va a guardar: normalizada, sin
 * duplicados, sin basura y recortada al tope.
 *
 * @param {unknown} valor - Lo que llegue del cliente. Si no es un array, se devuelve vacío.
 * @returns {string[]} Correos únicos, en minúsculas, con forma de correo y entregables,
 *   como máximo `MAX_NOTIFICATION_EMAILS`.
 * @throws Nunca: la entrada mala se descarta en silencio, no se rechaza.
 * @see normalizeEmail
 * @see isDeliverableEmail
 * @example
 * normalizeNotificationEmails(["Hola@X.com", "hola@x.com", "basura"]);
 * // => ["hola@x.com"]
 */
export const normalizeNotificationEmails = (valor) => {
```

### B3 · TSDoc, el de TypeDoc

Para TypeScript (el visor de Naeth, GridWatch). Sin tipos en la doc, porque los da el lenguaje; con
`@remarks` para el porqué y `@example` para el uso. Es lo que TypeDoc renderiza mejor.

```ts
/**
 * Deja la lista de correos de aviso como se va a guardar.
 *
 * @remarks
 * Se normaliza aquí y no solo en el modelo porque hace falta comparar unas con
 * otras para deduplicar: `"Hola@X.com"` y `"hola@x.com"` son la misma dirección,
 * y el `lowercase` del schema llega tarde para eso.
 *
 * @param valor - Lo que llegue del cliente; si no es un array, devuelve vacío.
 * @returns Correos únicos, en minúsculas y entregables, como máximo
 *   {@link MAX_NOTIFICATION_EMAILS}.
 *
 * @example
 * ```ts
 * normalizeNotificationEmails(["Hola@X.com", "hola@x.com", "basura"]) // ["hola@x.com"]
 * ```
 */
export const normalizeNotificationEmails = (valor: unknown): string[] => {
```

### B4 · Híbrido: tu narrativa dentro del JSDoc, y las etiquetas después

Es B0 metido en `/** */`, más las etiquetas mínimas. Lo que cambia respecto a hoy es el envoltorio y
dos líneas.

```js
/**
 * Deja la lista como se va a guardar: normalizada, sin duplicados, sin basura y
 * recortada al tope.
 *
 * Se normaliza AQUÍ y no solo en el modelo porque hace falta comparar unas con
 * otras para deduplicar, y "Hola@X.com" y "hola@x.com" son la misma dirección.
 * El `lowercase` del schema llega tarde para eso.
 *
 * LO QUE ESTO NO HACE: rechazar. Una entrada que no es array, un correo sin forma
 * o uno no entregable se descartan sin error, porque la lista es opcional y un
 * correo malo no debe impedir guardar el resto.
 *
 * @param {unknown} valor - Lo que llegue del cliente.
 * @returns {string[]} Como máximo `MAX_NOTIFICATION_EMAILS`, únicos y en minúsculas.
 */
export const normalizeNotificationEmails = (valor) => {
```

### B5 · La cabecera de fichero, como GridWatch 2025

No documenta una función sino el módulo entero: qué hay y para qué. Es el nivel que a Naeth le
falta en Python (los módulos tienen cabecera, pero de otra clase) y que la biblioteca necesita para
la vista por fichero.

```js
/**
 * @fileoverview
 * Utilidades de correo de Yogin-API: qué es un correo válido, cuál es un
 * marcador temporal (`@temp.com`), y cómo se dejan las listas de aviso antes de
 * guardarlas.
 *
 * Reglas que viven aquí y en ningún otro sitio:
 * - Un correo se compara siempre normalizado (minúsculas, sin espacios).
 * - Una lista de aviso tiene como máximo `MAX_NOTIFICATION_EMAILS` direcciones.
 * - Quien ya recibe el correo principal no recibe copia (`destinatariosDeCopia`).
 *
 * @module utils/email-utils
 */
```

---

## Parte C · Comparación

| Estilo | Herramientas que lo entienden | Lo valida un linter | Dónde va el porqué | Lo que espera un entrevistador de backend |
|---|---|---|---|---|
| A1 una línea | Todas | D1xx | No cabe | Para funciones triviales, sí |
| A2 PEP 257 | Todas, como párrafo | D1xx, D2xx | En el párrafo | Correcto y poco frecuente en empresa |
| A3 Google | pdoc, mkdocstrings, Sphinx con napoleon | D1xx, D4xx con `convention = "google"` | En el párrafo antes de `Args:` | **El más común en backend Python** |
| A4 NumPy | Igual que Google | `convention = "numpy"` | Igual | El de datos y ciencia, no de backend |
| A5 reST | Sphinx nativo | D1xx | Entre etiquetas, incómodo | Lo reconoce; ya no lo escribe nadie nuevo |
| A6 Epytext | Casi ninguna | No | Igual | Lo miraría raro |
| A7 narrativo | Todas, como párrafo | D1xx | Todo | Lo recordaría, y preguntaría qué devuelve |
| A8 híbrido | Igual que Google | Igual que Google | Delante | Lo que un revisor bueno pide: el porqué y el contrato |
| A9 tutorial | Igual que Google, y `doctest` | Igual, y el test | En el ejemplo | Bien en librerías, raro en servicios |
| A10 `#` encima | Ninguna | Falla D103 | Sí, pero invisible | Es lo que no debe verse |
| B2 JSDoc con tipos | JSDoc, el editor | `eslint-plugin-jsdoc` | Párrafo | Lo normal en JavaScript |
| B3 TSDoc | TypeDoc, el editor | `eslint-plugin-tsdoc` | `@remarks` | Lo normal en TypeScript |
| B4 híbrido JS | JSDoc | `eslint-plugin-jsdoc` | Delante | Igual que A8 |

**Tres cosas que la tabla no dice y pesan:**

1. **Google, NumPy y reST son el mismo contenido con otra puntuación.** La decisión real no es entre
   ellos, es entre A7 solo, A8 híbrido, o A3 sin narrativa. Elegido eso, la sintaxis de las secciones
   es Google porque es la que ruff valida y la que más gente lee.
2. **Los tipos no van en el docstring de Python.** Están en la firma (`n: int`, `-> list[dict]`) y
   griffe los saca de ahí. Repetirlos es tener dos copias. En JavaScript sí van, entre llaves, porque
   no hay otro sitio; en TypeScript no, por lo mismo.
3. **Lo que el linter puede exigir es la forma, nunca el porqué.** `D417` avisa si falta un parámetro
   en `Args:`; nada avisa si el párrafo dice "gestiona los jobs" en vez de contar el lease. Eso es la
   revisión, y por eso el hook de `Stop` sigue en el plan.

---

## Parte D · Cómo elegir, sin decidirlo por ti

Tres preguntas, y con las tres respondidas la guía queda cerrada:

1. **¿Narrativa siempre, o solo cuando hay porqué?** A8 en todo, o A3 para lo que solo tiene
   contrato y A8 para lo que tiene historia. Lo segundo es menos texto; lo primero es una sola regla.
2. **¿Secciones `Args:` y `Returns:` siempre, o solo cuando la firma no basta?** Siempre es más
   uniforme y ruff lo puede exigir con `D417`; solo cuando hace falta es lo que se propuso esta tarde
   y no se puede validar.
3. **¿`@example` en JavaScript y `Example:` en Python?** Vale mucho para quien llega nuevo y cuesta
   mantenerlo cierto. Una opción intermedia es exigirlo solo en las funciones exportadas de utilidad
   (`email-utils`, `public-event`) y no en rutas ni servicios.
