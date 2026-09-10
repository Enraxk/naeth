# Prompt de arranque de la fase 2 del cuaderno de código

Escrito el 10/09/2026 al cerrar el chat de la fase 1. Pégalo tal cual en una conversación nueva abierta en `F:\src\Naeth`.

```
Contexto, en tres líneas. El 10/09/2026 medí que he perdido la capacidad de recordar
los mecanismos de mis propios sistemas: 28 preguntas sobre mi propio código, 6 aciertos,
y ocho de los fallos eran sobre piezas que construí y documenté yo en las últimas seis
semanas. Diagnóstico: conservo el método y los principios, he perdido la recuperación,
y la causa probable es que he dejado de revisar el código que escriben los agentes por mí.
Decidí crear un cuaderno de código: cada vez que se escriba código, revisarlo, documentarlo
y dejarlo consultable. La fase 1 ya está hecha.

LEE PRIMERO, es la entrada obligatoria y no repitas su trabajo:
docs/plan/cuaderno-codigo-fase1-2026-09-10.md

DECIDIDO, no lo reabras:
- El cuaderno vive en un apartado nuevo de Naeth, no en un repo aparte ni en docs/.
- Se siembra con lo que YA existe: un barrido de Naeth, CENIT y Yogin.
- Con tope de tiempo cerrado como guarda, para que la siembra no sustituya al trabajo.
- Los dos puntos anteriores están en tensión y se resuelven así: un barrido exhaustivo de
  tres repos son semanas y el tope no lo es, así que el barrido es PRIORIZADO y se corta
  cuando se acaba el presupuesto.
- No aplico a la oferta de Tinybird. Ese hilo está cerrado y no es contexto de este trabajo.

TU TAREA: fase 2, planificación. Sub-fases atómicas y acotadas, cada una con un
entregable verificable, en el orden en que hay que hacerlas. No escribas código todavía.

Responde en este orden de prioridad:
1. EL ORDEN DEL BARRIDO Y EL TOPE, antes que nada. Si no fijas la prioridad antes de
   barrer, el primer repo se come el presupuesto. Propón tú el tope en horas y el orden,
   y di en qué te basas.
2. El aislamiento del cuaderno respecto a las búsquedas de prosa. No hay filtro negativo
   en la búsqueda de Naeth, así que si el código entra sin aislarse contamina todas mis
   búsquedas por defecto y quien busca no puede evitarlo. Con siembra de tres repos esto
   pasa de riesgo futuro a problema del primer día.
3. El disparador. Rige la regla del 15/08 (Naeth cf1f596b): un entregable de consulta
   compite contra hacerlo a pelo, y hacerlo a pelo siempre está a mano. Un cuaderno que
   haya que acordarse de consultar no se consultará. Di qué mecanismo lo pone delante solo.
4. Dónde vive el dato: columna nueva, metadata revivida, o la tabla attachment que ya
   existe vacía desde junio. Mira attachment ANTES de inventar nada.
5. Antes o después de la fase 2 del roadmap de producto. El documento argumenta que
   después es estrictamente más barato; confírmalo o refútalo.

LOS CUATRO CRITERIOS DE QUÉ MERECE FICHA ya están elegidos y están en el documento. Lo que
sí quiero de ti: BUSCA QUÉ OTROS CRITERIOS PUEDEN SER INTERESANTES, en vez de darlos por
cerrados. Y di cuál de todos sirve además como orden de prioridad del barrido.

ANTES DE PLANIFICAR, reusa la investigación previa que el documento ya localiza: ideas
F, L, N y B de docs/plan/naeth-ideas-2026-09-06.md, y fase-4-0-tope-y-prioridad.md como
método para cualquier campo acotado. Mi metodología exige comprobar si ya existe
investigación aplicable antes de hacer una nueva, y aquí existe.

FUERA DE ALCANCE, aunque salga en el documento: el 66% de notas con embedding truncado,
unescapeMarkdown sin guarda de bloque de código, y el README caducado. Son frentes propios.
Si el plan depende de alguno, dilo y para; no los arregles de paso.

QUÉ DEVUELVES: un solo fichero, docs/plan/cuaderno-codigo-fase2-<fecha>.md, con el plan
por sub-fases. Cada sub-fase con entregable verificable y con cómo se comprueba. Sin
código, sin SQL, sin migraciones escritas.

CRITERIO DE ÉXITO: que yo pueda coger la sub-fase 1 y empezarla sin volver a decidir nada,
y que cada sub-fase diga qué se rompe si falla.

RESTRICCIONES: cada afirmación sobre el código lleva fichero y línea; cada negativa lleva
el grep que la sostiene. Si algo del documento de fase 1 no cuadra con lo que encuentres
en disco, para y dímelo antes de construir encima. Y ojo: tocar naeth/app/ tira el 8801,
que es por donde entra Claude Code.
```

## Memorias de Naeth que dan contexto

- `dc15236d` la decisión del cuaderno, con los cuatro criterios y la tensión del barrido
- `7ddf94d1` el simulacro de recuperación, que es de donde nace todo esto
- `cf1f596b` la regla del 15/08 sobre entregables de consulta, que gobierna el disparador
- `9fbcf581` y `b370c3dd` los dos defectos que quedan FUERA de alcance
