# Discovery: la vista CDA diseñada en Pencil, con animaciones propias

Fecha: 15/09/2026, en curso. Brief y respuestas de Eneko en
`docs/plan/cda-vista-diseno-brief-2026-09-14.md`. El `.pen` vivo es `docs/design/cda-ficha.pen`
y sus exportaciones `docs/design/exports/*.png`.

Las ocho secciones del entregable se escriben al cerrar la discovery. Lo que hay hoy es el anexo A,
escrito a las 17:50 mientras se itera la pieza 2 (la tira V2e), porque la referencia de JetBrains
salió en la conversación y conviene tenerla entera antes de seguir eligiendo.

## Anexo A · Lo que hace bien el editor de JetBrains, y qué se lleva la ficha

Criterio: la ficha CDA no es un editor, es una lectura. Se copia lo que ayuda a orientarse y a leer
sin pedir nada; se descarta lo que existe para escribir. Cada cosa lleva su capa (0 reposo, 1 scroll,
2 ratón, 3 clic), que es la regla de integración propuesta el 15/09: cada capa la abre un gesto y se
retira sola. Fuente al lado de cada fila; lo que va de memoria y no se ha comprobado hoy en la doc
lleva ⚠.

| Lo de JetBrains | Qué hace | La ficha se lleva | Capa |
|---|---|---|---|
| Sticky lines (2024.1, hasta 5, clic para ir) [1] | Las declaraciones que te envuelven se quedan fijas arriba al hacer scroll | La firma del bloque fija; si también la sección de la doc, es la duda 1 | 1 |
| Barra de scroll con marcas (error stripe) [2] | La barra enseña dónde hay errores, avisos y TODO, por color | La tira de 48 px con la silueta del fichero, el bloque actual en acento y marcas ámbar en las anotaciones ⚠ | 0 |
| Inspections widget [2] | Arriba de la barra, un resumen: cuántos errores y avisos tiene el fichero | Un contador arriba de la tira: "4 notas · 2 ⚠" del bloque. Barato y evita abrir el margen para saberlo | 0 |
| Lens mode [2] | Al pasar el ratón por la barra, una vista del código de ese punto sin hacer scroll | La lente del bloque vecino: firma, primera línea de su doc, líneas, anotaciones, abrir. Ratón o clic es la duda 2 | 2 |
| CodeGlance Pro [3] | Minimapa con colores; opción "Show Minimap on scrollbar hover" (plegado hasta pasar el ratón, con retardo configurable), "quick hide", lente al pasar el ratón por el minimapa | La tira plegada a 8 px en reposo y entera con el ratón (fila 3 de los ejemplos). Si se elige, el retardo es obligatorio: sin él salta al ir al margen | 0 y 2 |
| Reader mode [4] | Para ficheros de solo lectura: los comentarios de doc renderizados como texto (Ctrl+Alt+Q o el icono del gutter), ligaduras, más interlineado, inlay hints de usos, formato virtual | Es la pieza 1 tal cual: la doc renderizada dentro del código con el icono en el gutter y "ver el docstring en crudo". Faltan como ajustes: ligaduras e interlineado, junto al tema y los brackets | 0 |
| Code Vision [5] | Encima de una clase o método, una línea gris: usos, herederos, autor. Configurable arriba o al final de línea | Encima de `def`, una línea gris: "3 usos · llama a 4 · Eneko, 28/08". Es la entrada natural a la capa 3: clic en "3 usos" abre el margen con V2b. Sin ella, el margen no tiene por dónde abrirse desde el código | 0, y 3 al clic |
| Inlay hints [5] | Nombres de parámetro y tipos inferidos, en gris dentro de la línea | Poco: los nombres ya están en la firma. Quizá en las llamadas del cuerpo (`core.search(query, k=k, …)`) no hace falta. Descartado por ahora | |
| Breadcrumbs [2] | Fichero › clase › método, abajo del editor | Las migas de la cabecera (`naeth / app / mcp_server.py / memory_search`). Ya están | 0 |
| Gutter [2] | Números de línea, anotaciones e iconos de acción según contexto | El gutter de la pieza 1: números, el icono de libro en la doc. Ya está | 0 |
| Structure popup y ventana Structure ⚠ | La lista de símbolos del fichero, con filtro, para saltar | El carril de la izquierda lista los bloques del fichero; la tira es su versión visual. No hace falta una tercera | 0 |
| Ctrl + ratón sobre un símbolo, y Quick Documentation ⚠ | El símbolo se subraya como enlace y sale la doc en un globo | El peek V1: símbolo subrayado, globo con firma y resumen, clic para ir. Ya elegido | 2 |
| Highlight usages of element at caret ⚠ | Con el cursor en una variable se iluminan todos sus usos en el fichero | Al pasar el ratón por un parámetro en la firma se iluminan sus usos en el cuerpo y su fila en PARÁMETROS. Es una animación propia barata, y enseña algo | 2 |
| Semantic highlighting y Rainbow Brackets ⚠ | Cada variable local con su color; los paréntesis anidados por colores | Los ajustes de apariencia del código que pidió Eneko en la pieza 1: tema (GitHub Default), brackets por nivel, variables por color, ligaduras, interlineado | 0 |
| Indent guides y línea actual ⚠ | Líneas finas verticales por nivel de sangría; la línea del cursor sombreada | Las guías de sangría, sí, cuestan nada y ayudan en Python. La línea actual no tiene sentido sin cursor; en su lugar, la línea que el vídeo o la anotación señala (ya está, L440) | 0 |
| Plegado (folding) con vista previa ⚠ | Un bloque plegado enseña una línea de resumen | La `description` plegada de la pieza 1, con su resumen y rango. Ya está | 0 |
| Method separators ⚠ | Líneas finas entre métodos | No: la ficha enseña un bloque, no el fichero | |
| Search Everywhere, Recent files ⚠ | Doble Shift busca todo; los ficheros recientes | Para la biblioteca, no para la ficha: buscar un símbolo en cualquier libro, y "seguir donde lo dejaste" | |
| New UI (2022.3 en adelante) ⚠ | Menos iconos, ventanas de herramientas escondidas por defecto, más aire | Es la misma dirección que "más aire y menos cajas" del 15/09. Nada que copiar, sí que confirmar | |

Lo que sale de la tabla para la pieza 2:

- **La tira lleva tres cosas en reposo**, no una: silueta, marcas ámbar y el contador arriba. Con eso
  el margen puede estar cerrado por defecto sin perder información.
- **La línea Code Vision encima de `def` es la que abre el margen.** Resuelve "cómo integrar todo sin
  sobrecargar": el vecindario no está a la vista, está a un clic en la línea que dice cuántos usos
  tiene. Es lo siguiente a dibujar.
- **Dos animaciones propias salen de aquí**: la lente que aparece desde la tira, y los usos de un
  parámetro iluminándose al pasar el ratón por la firma. Van a la lista de la sección 4.

Fuentes: [1] https://www.jetbrains.com/help/idea/sticky-lines.html y
https://blog.jetbrains.com/idea/2024/02/intellij-idea-2024-1-eap-4/ · [2]
https://www.jetbrains.com/help/idea/using-code-editor.html · [3]
https://github.com/Nasller/CodeGlancePro · [4] https://www.jetbrains.com/help/idea/reader-mode.html ·
[5] https://www.jetbrains.com/help/idea/inlay-hints.html y
https://plugins.jetbrains.com/docs/intellij/inlay-hints.html. Consultadas el 15/09/2026.

## Anexo B · Decisiones de la pieza 2 (15/09/2026, 19:15, AskUser)

Sobre `docs/design/exports/P2-V2e-v2.png`, `P2-V2e-dudas.png` y `P2-V2e-v3.png`:

1. **Al hacer scroll se quedan fijas dos filas**: la firma del bloque y la sección de la doc en la
   que estás (`Notes · por qué devuelve el digest`), cada una con sus líneas a la derecha. Clic en
   una fila lleva a ella.
2. **La lente del bloque vecino sale al pasar el ratón por la tira con retardo, y el clic la
   fija** con un × hasta cerrarla. El retardo existe para que no salte al cruzar la tira hacia el
   margen; CodeGlance Pro lo trae configurable y por defecto a 0 ms, aquí se mide en la sección 4
   (punto de partida, 300 ms, sin base).
3. **La tira mide siempre 48 px**: silueta del fichero, bloque actual en acento, marcas ámbar de
   anotaciones ⚠ y el contador arriba. No se pliega.
4. **Entran la línea Code Vision y el contador.** Encima de `def`: «3 usos · llama a 4 · Eneko ·
   28/08/2026»; «3 usos» y «llama a 4» son enlaces que abren el margen con V2b enfocado en quién
   llama o en las dependencias. Arriba de la tira: «4 · ⚠2», clic baja a la primera anotación.
   **El margen está cerrado por defecto**; la línea Code Vision es su única entrada desde el código.

Queda por dibujar de la pieza 2: la columna de código con todo junto (v4) y el margen abierto
desde «3 usos» (V2b con V2c desplegable). Después, la pieza 3 (anotaciones y nota de prosa) y la
biblioteca.

## Anexo C · Decisiones de la pieza 3, anotaciones y nota de prosa (15/09/2026, 21:35)

Sobre `docs/design/exports/P3-V1-cuaderno.png`, `P3-V2-en-linea.png`, `P3-V3-hilo.png` y sus
`*-pulido.png`. Lo que dijo Eneko: V1 "limpio y fácil de entender, puede ser una opción base"; V2
"puede ser muy interesante y útil, así se sabe perfectamente dónde está y por qué"; V3 "solo me
parece útil si acabo teniendo un modelo en local que me responda". Y "les falta una pulidita a las
tres", que es la segunda ronda.

1. **V1 es la base.** Las anotaciones van al pie del bloque, como cuaderno de lectura: sin cajas,
   icono, cabecera de una línea y texto con filete de cita; acciones (editar, enlazar, retirar)
   solo al pasar el ratón; la marca «importante» es una entrada más y la estrella de la cabecera;
   la nota de Naeth enlazada enseña título y digest con «abrir en Naeth»; anotar es un campo al
   final con `☆ importante`, `⌘K enlazar nota` y `⌘↵ guardar`.
2. **V2 entra como precisión opcional de la misma anotación, no como otro sistema.** Una anotación
   puede llevar línea o no. Si la lleva, sale anclada en el código (filete en acento, ancla en el
   gutter, `+` gris al pasar el ratón por una línea) y además en el cuaderno del pie con «en la
   línea 440» como enlace. **Pide `line integer null` en `code_annotation`**, que el plan de la
   sub-fase 4 no tiene: decisión pendiente antes de crear el esquema (sección 8).
3. **V3, el hilo lateral, se aparca** hasta que haya un modelo que responda (local o en servidor
   propio). Sin agente, V1 hace lo mismo con menos. Queda dibujado por si llega.
4. **Vocabulario.** «Notas» son las `Notes:` del docstring (las cuenta el contador de la tira,
   «4 · ⚠2»); «anotaciones» son la capa de Naeth (`code_annotation`); «nota de Naeth» o «nota
   enlazada» es la memoria con `memory_id`. El chip de la cabecera pasa a decir «2 anotaciones ·
   1 nota enlazada».

Especulación de Eneko al hilo de V3, apuntada sin más: alquilar un servidor "que no se caiga nunca"
para `naeth.dev`. A 15/09 `finally` ya es VPS y tiene los endpoints públicos; la pregunta sería
quién manda y quién replica, que es lo que CENIT resuelve con el failover.

Queda: la biblioteca (entrada a CDA, libro = repo).
