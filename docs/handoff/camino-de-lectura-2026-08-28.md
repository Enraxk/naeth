# NAETH · PLAN

# Camino de lectura: qué cojea y qué se hace

**Diagnóstico medido del 28/08/2026 y plan de mejora del camino de lectura de Naeth**

| Campo            | Valor                                                                 |
|------------------|-----------------------------------------------------------------------|
| Fecha            | 2026-08-28                                                            |
| Origen           | Informe de estado pedido en claude.ai, con `system_status` y 4 búsquedas |
| Estado           | Propuesta. Nada aprobado ni implementado                              |
| Alcance          | Camino de LECTURA de Naeth. No toca escritura, visor, multi-nodo ni CENIT |
| Destino sugerido | `F:\src\Naeth\docs\plan\camino-de-lectura-2026-08-28.md`               |

---

## 1. Datos de partida

Medidos con `system_status` el 28/08/2026. Se anotan para poder comprobar después si algo mejoró de verdad, no para decorar.

| Métrica                         | Valor    | Nota                                          |
|---------------------------------|----------|-----------------------------------------------|
| Filas escritas (histórico)      | 757      |                                               |
| Memorias vigentes               | 458      |                                               |
| Versiones superadas             | 275      | Derivado: 757 menos 458 menos 24. El 36,3%    |
| Retiradas (tombstone)           | 24       | 5,0% de las 482 líneas de memoria             |
| Versiones por línea             | 1,57     | Derivado                                      |
| Relaciones                      | 456      | Casi una por memoria vigente                  |
| Cola de embeddings              | 0 / 0    | Pendientes / errores                          |
| Retardo medio de embedding      | 7.873 s  | 2 h 11 min                                    |
| Sin modelo declarado            | 203      | 44,3% de las vigentes, `unknown_legacy`       |
| Rutas distintas                 | 80       | Sobre 26 proyectos, medido el 23/08           |

Curva de vigentes: 237 el 21/07 · 284 el 28/07 · 411 el 22/08 · 458 el 28/08. Son 7,8 al día en la última semana frente a 5,8 de media desde julio.

> 📌 **Lo que estas cifras dicen**
>
> El sistema de escritura está sano. El 36,3% de versiones superadas es la disciplina de supersede funcionando, no desperdicio, y el 5,0% de abandono significa que casi nada se escribe para arrepentirse después. Lo que cojea no es guardar, es leer.

---

## 2. Diagnóstico

La nota de Naeth hace dos trabajos incompatibles: es un documento para que lo lea una persona en el visor y es una unidad de recuperación para que la traiga un agente. Casi todo lo demás sale de ahí.

Tres síntomas concretos, todos observados el 28/08 al montar el informe de estado:

• Responder una pregunta agregada costó cuatro búsquedas y del orden de 40.000 palabras de contexto, porque `memory_search` devuelve el contenido íntegro de cada resultado.

• Los scores de esas búsquedas iban de 0,013 a 0,016, o sea ruido de RRF. La única palanca disponible es la cadena de texto, así que la consulta compite contra las 458 memorias enteras.

• Preguntas de inventario (cuántas notas hay sin título, reparto por path, longitud de las cadenas) no se pueden responder con las tools actuales. Hubo que derivarlas a mano y una de ellas quedó sin responder.

> 💡 **La asimetría de fondo**
>
> El ritual de escritura tiene skill propia, dos modos, informe revisable, frase de confirmación y relectura previa. El de lectura no existe: hay `memory_search` y poco más. Se ha invertido mucho en qué se guarda y casi nada en cómo se recupera.

---

## 3. Nivel 1: cambios en el core

Los cuatro primeros. Tres son aditivos y no rompen contratos; el cuarto sí y es el trabajo de verdad.

### 3.1 Filtros en `memory_search`

**Qué.** Añadir `path_prefix`, `tags`, `memory_type`, `since` e `is_current` como parámetros. Filtrar antes de rankear, no después.

**Por qué.** Es la mejora de recall más barata disponible. El 28/08 la consulta "inventario de Naeth" devolvió el keynote de inversores de John con score 0,015; con `path_prefix=naeth/` habría competido contra unas 60 notas en vez de contra 458.

**Criterio de verificación.** Repetir tres consultas que hoy fallan, con y sin filtro, y comprobar que la nota esperada sube a las tres primeras posiciones. Sin ese antes y después no se sabe si mejoró.

**Riesgo.** Ninguno de contrato: son parámetros opcionales.

### 3.2 Tool de introspección (`memory_stats`)

**Qué.** Una tool nueva con dos modos, recuento e higiene.

Recuento, agrupando por `path`, subtema, `memory_type`, tag, autor y mes.

Higiene, que devuelve listas concretas:

• memorias sin título
• memorias sin tags
• memorias con path fuera de la taxonomía viva
• longitud de las cadenas de supersession, para ver qué se reescribe mucho
• memorias huérfanas, sin relación entrante ni saliente
• wikilinks que no resuelven

**Por qué.** Es lo que convierte el informe del 28/08 en una llamada en vez de en una tarde. Y es el instrumento que hoy falta para decidir con datos en vez de con impresión.

**Criterio de verificación.** Que reproduzca a mano las cifras de la sección 1 de este documento, incluidas las dos memorias sin título ya conocidas.

> ⚠️ **Las dos memorias sin título ya están identificadas**
>
> `14134724` y `f94961e3`, las dos en `cenit/build`, anotadas en `naeth/status` desde el 23/08 como pendiente menor. Un `memory_stats` que no las encuentre está mal implementado: son el caso de prueba.

### 3.3 Fallback léxico para lo que aún no está embebido

**Qué.** Que `memory_search` haga siempre una pasada léxica sobre las filas con embedding pendiente y la una al resultado del ranking híbrido.

**Por qué.** El retardo medio es de 2 h 11 min. Hoy eso es una regla que hay que recordar (el gotcha 2 del `userPreferences`: "una memoria recién escrita puede no salir aún en `memory_search`"). Convertir una regla que depende de acordarse en comportamiento del sistema es el patrón que ya se aplicó con el em dash y con el reloj.

**Criterio de verificación.** Escribir una memoria y buscarla por una frase suya al segundo siguiente, con la cola parada a propósito. Debe salir.

**Riesgo.** Bajo. Son pocas filas y el componente léxico ya existe.

### 3.4 `memory_search` deja de devolver contenido completo

Este es el grande y del que cuelga el resto.

**Qué.** Columna `digest` nueva, obligatoria en las cinco tools de escritura, con tope duro de unos 280 caracteres. `memory_search` pasa a devolver `id`, `title`, `path`, `memory_type`, `tags`, `created_at`, `digest` y `score`. El contenido íntegro solo por `memory_get`.

**Por qué.** Es lo que rompe el techo de contexto. Diez digests ocupan lo que hoy ocupa media nota, y la decisión de qué abrir entero pasa a tomarse a sabiendas.

**Cómo se escribe el digest.** Lo escribe el autor en el acto de guardar. Nunca se genera después de forma automática, y este punto no es negociable por un motivo específico de este corpus.

> ⚠️ **Trampa: las notas contienen sus propias versiones refutadas**
>
> Varias memorias llevan dentro un hallazgo anulado con su aviso al lado. La del roadmap de GridWatch dice literalmente "NO USAR ese argumento" sobre algo que ella misma explica. Un resumidor automático puede destilar perfectamente la parte anulada y presentarla como el contenido de la nota.
>
> Consecuencia para el backfill de las 458 vigentes: no puede ser una pasada de LLM sin revisión. O se extrae del primer bloque en las que ya siguen la convención de titular, o se revisa a mano, o se hace por proyecto en tandas aprobadas como cualquier otra escritura.

**Efecto lateral bueno.** El digest es un test de calidad de la nota: si el punto no cabe en 280 caracteres, la nota está haciendo dos trabajos y hay que partirla.

**Criterio de verificación.** Rehacer el informe de estado del 28/08 con las tools nuevas y medir el contexto consumido. Si no baja al menos un orden de magnitud, el cambio no ha valido.

**Riesgo.** Alto en alcance: toca esquema, las cinco tools de escritura, la skill `NaethPersist`, el visor y obliga a un backfill revisado de 458 notas.

---

## 4. Nivel 2: real pero no urgente

### 4.1 Los wikilinks se están pudriendo en silencio

**El problema, en dos capas.** La superficial es que conviven tres formatos: UUID completo, prefijo de 8 caracteres (que además está documentado como fallo seguro) y título literal.

La de fondo es peor. Las relaciones del grafo siguen la cadena de supersession, pero un wikilink dentro del texto es una referencia congelada: cuando la nota destino se supersede, el enlace sigue apuntando a la versión vieja, y quien lo siga leerá historia creyendo que lee lo vigente.

**Propuesta.** Forma canónica `[[uuid|texto visible]]`, resolución al head de la cadena en el momento de leer, validador en el camino de escritura que avise de enlaces irresolubles, y migración de los 263 existentes.

**Criterio de verificación.** Superseder una nota muy enlazada y comprobar que los enlaces entrantes llevan a la versión nueva.

### 4.2 Conflicto de superficie, resuelto en el servidor

**El hecho.** Hay 5 memorias vigentes con `product: claude-code` y `surface: web`, todas con modelo `claude-opus-4-8`. Es una contradicción: el producto sale del `clientInfo` de la app cliente y es fiable, la superficie sale del `?s=` del endpoint y depende de por qué conector se entró.

> ⚠️ **No están fechadas y la atribución no es concluyente**
>
> Encajan igual de bien con el incidente del conector del 08 al 11/08 que con la duplicación de conectores detectada el 25/08. El modelo `opus-4-8` es compatible con las dos. Mirar `created_at` de esas cinco filas antes de sacar conclusiones, y no darlas por evidencia de la duplicación en curso hasta hacerlo.

**Propuesta.** Cuando producto y superficie no cuadren, escribir la superficie que dice el producto y marcar `surface_conflict: true`. No arregla la duplicación de conectores, que es una decisión con coste real, pero deja el dato honesto y da el contador para saber cuánto pasa de verdad.

### 4.3 Que "no tengo nada de esto" sea una respuesta

**El problema.** `memory_search` siempre devuelve k resultados. Nunca dice que no hay nada, solo baja el score. Con scores de 0,013 a 0,016 no se distingue "esto es lo relevante" de "esto es lo menos irrelevante", y ahí es exactamente donde se cuela una respuesta plausible e inventada.

**Propuesta.** Un suelo de score por debajo del cual los resultados se devuelven etiquetados como no concluyentes.

**Precedente que lo justifica.** El origen del nombre Naeth: la respuesta correcta era "no está guardado" y costó tres búsquedas establecerlo.

### 4.4 Un ritual de lectura

**Qué.** Una skill o un modo que dispare con "retomo X" y traiga el `proyecto/status`, lo que quedó abierto y los últimos checkpoints de ese proyecto.

**Por qué.** `proyecto/status` ya hace el trabajo, pero depende de que alguien se acuerde de abrirlo. Es la simétrica de `NaethPersist` y hoy no existe.

---

## 5. Descartado, y por qué

Esta sección existe para no volver a discutirlo dentro de tres meses.

| Idea | Motivo del descarte |
|---|---|
| Campo `state` (abierto/cerrado) por memoria | Mismo defecto que la escala de prioridad ya rechazada el 21/07: se degrada solo. Nadie lo mantiene, y a los tres meses hay notas marcadas abiertas que se cerraron en junio. Lo que sí tiene escritor regular es `proyecto/status`, porque el checkpoint lo actualiza siempre |
| `review_after` o caducidad por nota | Mismo problema. Si acaso se deriva: una nota de un proyecto con status activo sin tocar en 60 días sale en el informe de higiene, sin que nadie rellene nada |
| Chunking con embeddings por trozo | Es la solución de manual y aquí es peligrosa. Trocear haría que un fragmento refutado se recupere sin su corrección al lado. En un corpus de hechos sería correcto; en uno argumentativo que se corrige a sí mismo, es una máquina de propagar cosas falsas |
| Reranker cross-encoder | Es la respuesta bonita a los scores malos y probablemente sobra si entran los filtros. Medirlo después, no antes |
| Purgar o archivar por antigüedad | Resuelve el síntoma equivocado. A 7,8 notas al día son unas 2.800 vigentes en un año, y 2.800 digests son manejables. El problema no es cuántas notas hay, es que cada búsqueda devuelva diez enteras |

---

## 6. Orden de ejecución

Etiquetado en orden de ejecución, no de importancia conceptual.

| Paso | Trabajo | Tamaño | Por qué va aquí |
|---|---|---|---|
| 1 | Filtros en `memory_search` (3.1) | Una sesión | Aditivo, sin romper contratos, y mejora el recall desde el primer día |
| 2 | `memory_stats` (3.2) | Una sesión | A partir de aquí el sistema se mide en vez de estimarse, y eso reordena lo demás |
| 3 | Fallback léxico (3.3) | Pequeño | Borra una regla del `userPreferences` |
| 4 | Digest (3.4) | El trabajo grande | Toca esquema, tools, skill, visor y backfill revisado |
| 5 | Wikilinks (4.1) y conflicto de superficie (4.2) | Medio | Cuando lo anterior esté asentado |
| 6 | Señal de vacío (4.3) y ritual de lectura (4.4) | Pequeño | Cierre |

> ⚠️ **El aviso que importa**
>
> Hay una versión de esta lista que es un proyecto de tres meses con arquitectura de capas, cola de reindexado y un panel de métricas. No es esa. Los tres primeros pasos son fontanería aditiva y valen la mayor parte del beneficio.
>
> Empezar por el digest porque es el interesante significa dos semanas de backfill antes de haber tocado lo que habría dado datos para decidir el orden. Ese es el modo de fallo conocido y está aquí escrito a propósito.

---

## 7. Lo que este plan no toca

• El camino de escritura y el ritual `NaethPersist`, que funcionan.
• El visor, que va por su propia rama (v2.1, vista Nueva memoria en curso).
• El multi-nodo, el failover y CENIT.
• La decisión sobre el conector duplicado, que es de Eneko y tiene coste real: retirar el conector de cuenta deja sin Naeth a claude.ai y a la app de escritorio.
• El vocabulario de `memory_type`, que hoy dice tres cosas distintas (cuatro en la convención, seis en el visor, cinco en el corpus). Es un pendiente vivo de `naeth/conventions`, no de este plan.

---

*Naeth · Camino de lectura · 2026-08-28*
