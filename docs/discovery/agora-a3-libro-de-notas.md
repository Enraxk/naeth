# Para Agora · A3: qué es un libro cuando el contenido son notas

Material de revisión preparado el 02/10/2026 a las 20:10. Sale de la sección 6 (A3) de
[`naeth-vision-2026-10.md`](naeth-vision-2026-10.md). El diagrama está en
`F:/src/Diagramas/naeth-libro-notas.excalidraw` (con su PNG al lado).

## Qué se pide

Revisar críticamente **la propuesta de qué es un libro de notas** en la biblioteca de Naeth: si se
sostiene con los datos, qué casos la rompen y qué falta decidir. Eneko marcó las cuatro piezas de la
propuesta como aceptables, pero quiere la revisión antes de darla por buena.

**Fuera de la revisión**, porque ya está decidido en CDA y no se rehace: qué es un libro de código (un
repo; partes = carpetas de primer nivel; capítulo = fichero; página = bloque; prólogo = README),
cómo se lee (doble página en escritorio, una página con botones en móvil), la estantería sin mesa, y
las reglas de animación. Todo está en `cda-vista-diseno-2026-09-15.md` y
`cda-biblioteca-espacio-2026-09-21.md`. Es todo "de momento": la estética se decide con Tania y sus
renders.

## El contexto en cuatro líneas

- Naeth es una memoria de notas (Postgres, 690 notas vigentes, 29 proyectos) que se quiere convertir
  en una biblioteca de todo el conocimiento: notas, código y ficheros.
- Cada nota tiene una ruta `proyecto/subtema` (dos niveles, convención fija), un tipo, etiquetas,
  relaciones tipadas con otras notas y una cadena de versiones (las notas no se editan: se superan).
- La biblioteca de código (CDA) ya decidió su forma de libro; el 21/09 Eneko aplazó qué es un libro
  de notas hasta terminar CDA, con "por proyecto puede estar bien" como idea. El 02/10 decidió
  resolverlo ya.
- Por MCP entraron 682 de las 685 notas: casi nadie escribe en el visor; la biblioteca es para leer.

## La propuesta

1. **Libro = proyecto.** Capítulo = subtema. Página = nota, en orden de creación dentro del capítulo,
   así el libro crece por el final. Una nota larga ocupa varias páginas.
2. **Prólogo = la nota `proyecto/status`**, que por convención es el punto de entrada del proyecto.
3. **Colección con el código.** Las notas de un proyecto son un volumen más de la colección del
   proyecto, con el mismo lomo y la misma tela que sus repos y que sus obras (PDF). Precedente de CDA:
   "Yogin son dos libros con el mismo lomo".
4. **Ediciones al margen.** La página enseña la versión vigente; las anteriores van al margen, no
   como páginas.
5. **Referencias al pie.** Una relación con una nota de otro proyecto va al pie, como "véase".
6. **Cuadernillos.** Los proyectos de 1 a 5 notas no son libros: van juntos en una caja de cuadernos.

## Los datos (producción, solo lectura, 02/10/2026)

- **Relaciones vivas entre notas vigentes: 349.** Dentro del mismo subtema 165 (47%); mismo proyecto
  y otro subtema 102 (29%); entre proyectos 82 (23%). Con libro = proyecto, el 77% queda dentro del
  libro; con libro = subtema, el 47%.
- **Tamaños**: 6 proyectos de 1 nota, 9 de 2 a 5 (29 notas), 4 de 6 a 20 (37), 4 de 21 a 50 (137), 6 de
  más de 50 (481). Los grandes: yogin 107 notas en 5 subtemas (327.228 caracteres), naeth 104 en 9,
  eneko 81 en 3, inkerlum 69 en 9, cenit 64 en 5, gridwatch 56 en 7.
- **Una nota**: mediana de 2.260 caracteres, p95 de 5.673, máximo 36.266.
- **Prólogo**: 27 de 29 proyectos tienen nota de status.
- **Historia**: 194 de 690 vigentes (28%) tienen versiones anteriores; la cadena más larga, 32 (el
  status de Naeth).
- **Crecimiento**: unas 250 notas al mes; 11 proyectos solo tienen notas de un mes.
- **Casos límite medidos**:
  - ninguna nota vigente sin ruta;
  - de 447 supersesiones, **8 cambiaron de proyecto y 27 de subtema**: la página saltaría de libro o
    de capítulo entre versiones;
  - **`eneko/method` son 79 notas de método transversal**, en un solo capítulo, y `eneko` es el
    proyecto que más aparece en las relaciones entre proyectos (destino de 7 desde naeth, 6 desde
    cenit, 5 desde skills, 5 desde yogin).

## Las opciones que se descartaron

- **Libro = subtema**: 96 libros, casi todos delgados; solo el 47% de las relaciones dentro.
- **Libro = periodo** (mes o trimestre, como un diario): parte cada proyecto y corta casi todas las
  relaciones.
- **Libro = grupo que forma la IA por embeddings**: cambia con cada nota nueva; un libro que se
  reordena solo no es un libro.

## Preguntas abiertas que la revisión puede contestar o señalar

- El proyecto `eneko` (método transversal) y `personal`: ¿son libros como los demás, o necesitan otra
  forma?
- Qué pasa con la página que cambia de proyecto o de subtema entre versiones (8 y 27 casos).
- Si el orden de creación es el orden de lectura correcto, o el capítulo debería abrirse por lo más
  reciente, o por lo más enlazado.
- Si el umbral de los cuadernillos (5 notas) tiene base o es arbitrario.
- Si "ediciones al margen" aguanta 31 ediciones (el status de Naeth).
- Cómo crece esto con unas 3.000 notas al año.
