# Naeth: preguntas incómodas e ideas, de las sensatas a las locas

Ronda abierta el 06/09/2026, a petición de Eneko: "una ronda más profunda de preguntas e ideas
creativas o más locas, para Naeth en general". No es un plan y no hay orden de ejecución. Es
material para decidir, y como en la ronda del grafo, **cada idea lleva delante el dato que la
sostiene y detrás qué habría que medir antes de construirla**.

La lista del grafo vive aparte, en `grafo-lo-que-queremos.md`. Esto es el sistema entero.

---

## 1. Lo que el corpus dice de sí mismo, medido hoy

Todo contra producción el 06/09/2026, no estimado.

| Qué | Cuánto | Por qué importa |
|---|---|---|
| Vigentes / filas | **529 / 907** | 357 supersesiones: corregirse es lo normal, no la excepción |
| Edad de lo vigente | **249** de menos de un mes, 189 de uno a dos, **91 de más de dos** | El corpus es joven. El problema nunca será el volumen: será saber qué caducó |
| Ritmo | **230 memorias al mes** sobre cuatro meses de vida | En un año son 3.000. Nada de lo que funciona hoy está probado a esa escala |
| Tamaño de una memoria | media **2.640** caracteres, mediana 2.366, **máximo 36.266** | Esto no son notas: son ensayos. 170 pasan de 3.000 caracteres |
| Incertidumbre declarada | **44 vigentes** dicen hipótesis, sin verificar o sin confirmar. **14 llevan más de 30 días así** | Son afirmaciones que el propio sistema marcó como frágiles y nadie volvió a mirar |
| Avisos | **89 vigentes** llevan un `⚠` | Una de cada seis memorias grita algo |
| Tags | **695 distintos, 403 usados UNA sola vez** (58%) | El vocabulario libre se desbordó. La mitad de los tags no clasifican nada |
| Relaciones | **501**, con **cero recíprocas** | La dirección nunca es redundante |
| Aisladas | **192 vigentes (36%)** sin una sola relación explícita | Un tercio del corpus solo se alcanza por búsqueda |
| Lecturas registradas | **ninguna** | Ver la idea B: es el agujero más grande y el más barato de tapar |
| Adjuntos | tabla `attachment` creada y **vacía** | Existe la posibilidad y no se usa |
| Autoría | 299 `code`, 41 `web`, 3 `visor`, **186 sin marcar** | Un tercio del corpus no sabe quién lo escribió |

**La lectura de una línea:** Naeth guarda bien, encuentra bien, y **no sabe nada de sí mismo**. No
sabe qué se lee, qué se quedó a medias, ni qué ha dejado de ser cierto.

---

## 2. Banda 1 · Lo que el corpus pide a gritos

Cosas pequeñas, con dato detrás y coste bajo. Si algo de esta ronda se hace, empieza aquí.

### A. La deuda de verificación, que hoy es invisible

**44 memorias vigentes declaran una hipótesis o algo sin verificar. 14 llevan más de un mes así.**
Una de ellas es la del traspaso del testigo, abierta el 04/09 y confirmada el 06/09 **de rebote**,
verificando otra cosa. Nadie fue a cerrarla: se cerró sola porque pasó por delante.

La idea es una tool y una vista: **lo que Naeth afirma sin estar seguro, ordenado por antigüedad**.
No es un TODO, y esa es la diferencia: son afirmaciones que ya están sirviendo de base a decisiones.

- **Qué medir antes**: de esas 44, cuántas son de verdad hipótesis abiertas y cuántas solo mencionan
  la palabra. Se lee a ojo en una tarde, y el número real decide si la idea vale.
- **Y una pregunta de diseño**: ¿la marca la pone quien escribe (un campo) o se detecta del texto? Lo
  primero es fiable y se olvida; lo segundo no se olvida y falla.

### B. Naeth no sabe qué se lee, y eso se arregla con una tabla

No hay registro de accesos. Ninguno. Consecuencias que hoy no se pueden responder: qué memorias
sostienen el trabajo real, cuáles no ha abierto nadie desde que se escribieron, y **qué se buscó sin
encontrar nada**.

Esa última es la buena. **Los hits dicen lo que Naeth tiene; las búsquedas vacías dicen lo que le
falta.** Es la única señal que existe de un hueco en la memoria, y ahora mismo se tira a la basura
en cada llamada.

- **Qué medir antes**: cuántas búsquedas al día se hacen de verdad, sumando Claude Code y claude.ai.
  Si son 30, una tabla es un chiste; si son 3.000, hay que pensar la retención.
- **Riesgo real y no teórico**: registrar consultas convierte a Naeth en un registro de en qué
  trabaja Eneko a cada hora. Es suyo y local, pero deja de ser solo un almacén de notas.

### C. Los tags son un cementerio, y hay que decidir qué son

**403 de 695 tags se usan una sola vez.** La convención dice "el proyecto primero, luego subtema
libre", y el libre se desbordó. Tres salidas, y no son compatibles:

1. **Limpiar**: consolidar los hápax en el vocabulario que ya existe. Trabajo manual y se vuelve a
   desbordar en tres meses.
2. **Aceptarlos como texto libre** y quitarles toda función de clasificación, que ya la hace el path.
3. **Convertirlos en nodos del grafo** (la idea C de la lista del grafo). ⚠ Con este dato delante,
   esa idea pierde fuerza: **la mitad de esos 695 nodos serían hojas de grado 1**, o sea ruido puro.
   Medir esto antes ha ahorrado construirlo.

### D. Un tercio del corpus no tiene una sola relación

**192 vigentes aisladas.** Se alcanzan por búsqueda, por wikilink al vuelo o por vecino semántico,
pero nadie las ató a nada a mano. No es necesariamente un defecto: puede que ese tercio sean notas
que de verdad no se relacionan con nada. O puede que sea el trabajo de relacionar, que es aburrido y
no se hace.

- **Qué medir antes**: de una muestra de 20 aisladas, cuántas tienen un vecino semántico obvio que
  debería ser relación. Si son más de la mitad, la idea es **proponer relaciones**, no exigirlas.

---

## 3. Banda 2 · Ideas que cambian cómo se usa Naeth

Aquí ya no es tapar un agujero: es que Naeth haga algo que hoy no hace.

### E. La memoria que te avisa de que te estás contradiciendo

Hoy, detectar que una memoria nueva choca con una vieja es trabajo del ritual de checkpoint, a mano,
y funciona porque lo hace un agente con tiempo. **357 supersesiones** dicen que corregirse es
constante.

La idea: que `memory_add` busque las tres más cercanas y **avise** ("esto se solapa con X, del 12
de julio, que afirma lo contrario"). Aviso, no bloqueo: bloquear haría que se dejara de escribir.

- **Qué medir antes**: con la similitud comprimida del corpus (dos memorias al azar ya se parecen
  0,874), **el vecino más cercano de casi todo va a parecer relevante**. Hay que ver si el aviso
  acierta o es ruido constante, y eso se prueba en seco contra 20 escrituras pasadas.

### F. Qué haría falsa a esta memoria

El digest dice **qué afirma** una nota. La vuelta que falta es **qué la mataría**: una condición de
caducidad escrita por quien la escribe. "Esto deja de valer si el visor deja de compilarse dentro de
la imagen". "Esto caduca cuando Vicky cambie de tarifa".

Con 91 memorias de más de dos meses y ritmo de 230 al mes, el problema de Naeth **nunca va a ser
encontrar**: va a ser saber qué encontrado ya no vale. Un campo de dos líneas resuelve más que
cualquier algoritmo de relevancia.

- **Qué medir antes**: coger 20 memorias antiguas y escribirles la condición a posteriori. Si cuesta
  escribirla, la idea no vale; si sale sola, es la idea más rentable de esta lista.

### G. La puerta del tiempo, que hoy no existe

Se entra por `proyecto/subtema`, por búsqueda o por el grafo. **No se entra por "qué pensaba yo en
julio".** Hay 148 memorias con varias versiones, una con 21, y esa historia intelectual está
guardada entera y no tiene puerta.

Lo concreto y pequeño: **el diff entre dos versiones de una memoria**, renderizado en el visor. Ver
qué cambió de opinión, cuándo, y con qué argumento. Lo grande sería el time-lapse del corpus, que ya
está en la lista del grafo y cuesta mucho más.

### H. Naeth pregunta, en vez de solo responder

Hoy Naeth es estrictamente pasivo: responde si se le busca, escribe si se le manda. La suma de A, F
y G permite algo distinto: que al abrir una sesión diga **"de lo que dejaste abierto hace más de un
mes, esto sigue abierto"**.

⚠ Esto cruza una línea de diseño, y es una decisión de Eneko, no técnica: **un sistema que habla sin
que se le hable deja de ser un archivo**. Ver la pregunta 1.

---

## 4. Banda 3 · Las locas

Sin filtro de viabilidad. Están aquí porque una de estas suele ser la buena.

### I. El corpus se lee a sí mismo, una vez al mes

Un pase que busque pares muy cercanos y proponga fusión o supersesión. Es la versión automática del
checkpoint. **La similitud comprimida lo hace difícil de verdad**: hay que trabajar por percentil
del corpus y no por umbral, exactamente como se decidió para el grafo.

### J. Memorias que piden renovación en vez de caducar

Nada se borra, que es la regla. Pero una memoria de infraestructura de hace 90 días podría **pedir
que la renueven**: un supersede que no cambia el texto, solo la fecha y la firma de que sigue
valiendo. Convierte "estar viejo" en "estar sin renovar", que es una señal mucho más honesta.

### K. Naeth para un tercero, en solo lectura

Hoy es de uno. Ya hay SSO, OIDC y árbol por proyecto: dar acceso de lectura a `gridwatch/*` a un
cliente es técnicamente pequeño. Lo que no es pequeño: **89 memorias llevan un `⚠` y muchas dicen
cosas sobre personas**. Cualquier apertura empieza por una revisión de qué se ha escrito.

### L. La anotación al margen, sin superseder

Que un agente pueda dejar una nota **pegada** a una memoria sin crear versión: "leí esto el 6/9 y no
me cuadra con Y". Hoy la única forma de comentar algo es superseder, que es demasiado ceremonioso
para una duda. Es ADD-only igual, pero de otro tipo.

### M. El paseo de domingo

Naeth elige tres memorias que no se han abierto en dos meses y las cuenta. Es lo contrario del
buscador: no responde a una pregunta, **te devuelve algo que ya no recordabas que sabías**. Necesita
la idea B (saber qué se ha leído) para funcionar, y sin ella es imposible.

### N. La memoria con adjuntos, que ya está a medias

La tabla `attachment` existe y está **vacía**. Alguien la creó pensando en algo. Con adjuntos, una
memoria de Inkerlum podría llevar el mapa, una de Gridwatch el PDF del contrato, una de CENIT el
diagrama. Hoy todo eso vive fuera y se enlaza a mano o se pierde.

### O. Naeth escribe lo que se demuestra

Un modo estricto para memorias importantes: la nota no entra hasta que un segundo agente la verifica
contra la fuente. Caro y lento, y por eso solo para decisiones que van a sostener dinero o
infraestructura. Es la vacuna contra el patrón que ya está registrado tres veces: **un documento
propio afirma algo, nadie lo comprueba, y acaba sosteniendo un precio**.

### P. Que Naeth tenga una opinión sobre su propio crecimiento

A 230 al mes, en un año hay 3.000 memorias. **Nada de lo que hoy funciona está probado a esa
escala**, y la similitud ya está comprimida hoy. La idea es medir la degradación a propósito:
duplicar el corpus con memorias sintéticas y ver a partir de qué número la búsqueda deja de
distinguir. Es el mismo truco del banco de motores del grafo, aplicado al corazón del sistema.

---

## 5. Las preguntas, que son la mitad importante de esta ronda

No son retóricas: cada una cambia qué se construye.

1. **¿Naeth es un archivo o un interlocutor?** Hoy es archivo puro: responde y guarda cuando se le
   dice. Las ideas H, J y M lo convierten en algo que habla solo. Es la pregunta que gobierna la
   mitad de esta lista.
2. **¿Qué es peso muerto para ti?** ¿Te molesta que haya 91 memorias de más de dos meses, o el
   problema es no saber cuáles ya no valen? Si es lo segundo, la idea F se come a las demás.
3. **¿Para quién es Naeth?** Solo tú y tus agentes, o alguna vez un tercero (un cliente, un
   colaborador, el público). Cambia la seguridad, la redacción y hasta lo que se escribe.
4. **¿Quieres que Naeth marque contradicciones aunque no sepa cuál gana?** Un sistema que dice "esto
   choca" sin resolver es útil o es ruido, y depende entera de cuánto te fíes del aviso.
5. **¿Qué te gustaría preguntarle a Naeth que hoy no puedes?** La pregunta madre. Las diez ideas de
   arriba salen de mirar los datos; esta sale de mirar el uso, que es donde vive lo que falta.
6. **¿El visor es para trabajar o para mirar?** El grafo es contemplativo, la ficha es de trabajo, y
   ahora conviven. Si es para trabajar, la siguiente pieza es el buscador. Si es para mirar, es el
   tiempo.
