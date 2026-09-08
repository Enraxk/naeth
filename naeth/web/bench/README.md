# Los bancos del grafo

Páginas sueltas que corren contra el **grafo real** (`/api/tree` y `/api/graph`) y sirven para
decidir algo que discutiendo no se decide. No son tests, no entran en la suite y no se despliegan:
se abren a mano con el servidor de desarrollo levantado.

```
npm run dev
```

y luego `http://localhost:5173/bench/<el que sea>.html` (o el puerto que use tu `launch.json`).

## Los cinco, y qué decidió cada uno

| Banco | Fecha | Qué decidió |
|---|---|---|
| [`motor`](motor.html) | 05/09/2026 | **Canvas contra SVG.** Con el corpus de hoy los cuatro candidatos pasaban de 140 fps; a diez veces el corpus, canvas sostiene 45 y SVG 19. ⚠ Su criterio, declarado antes de mirar, **no discriminó**: la elección la dio el margen a futuro, y eso quedó escrito tal cual |
| [`vecindario`](vecindario.html) | 05/09/2026 | **El mapa de posiciones compartido.** Simular el vecindario aparte pierde 66 grados y el 90% del orden de los vecinos. Y tumbó el anclado selectivo, que era una propuesta mía: sale peor a partir del mes |
| [`arista`](arista.html) | 06/09/2026 | **Cuánto sitio hay en un trazo.** La arista mediana mide 19 px a encuadre completo, así que la punta de flecha entra en el 97%. Mató el degradado (necesita 30 px y solo los tiene el 18%) y el grosor |
| [`canal-vivo`](canal-vivo.html) | 06/09/2026 | **Que "cabe" no es "se lee".** Las mismas candidatas sobre el grafo entero, con resalte y aumento. De aquí salió el control de fuerza del tinte, porque a plena saturación el grafo se vuelve azul |
| [`fuerzas`](fuerzas.html) | 06/09/2026 | **Que los deslizadores de física van en continuo.** Reconfigurar una fuerza viva cuesta 0,05-0,2 ms contra los 121-269 ms de reconstruir el simulador |

## Panel y banco no hacen lo mismo

Desde el 08/09/2026 el visor tiene su panel de ajustes, y eso **no jubila los bancos**, solo les
quita un encargo:

- El **banco compara alternativas que todavía no existen en el código**. Sirve para elegir entre
  formas de pintar algo, y sobre todo para tumbar una idea antes de construirla, que es lo que hizo
  dos veces de cinco.
- El **panel afina una configuración** sobre el visor real. Sirve para llevar un valor de "casi" a
  "eso es", y para que cada persona tenga el suyo.

Lo que ya no hace falta es escribir un banco **para elegir un número**. Eso era `canal-vivo` con el
tinte, y hoy es un deslizador.

## Si escribes uno nuevo

- **Importa las constantes de `src/lib/`, no las copies.** Los cinco lo hacen: si alguien cambia el
  trazo de una capa o el radio de un nodo, el banco cambia con ellos. Un banco que mide una copia de
  la física mide otra aplicación.
- **Declara el criterio ANTES de mirar los números**, y si luego no discrimina, escríbelo. Pasó en
  `motor` y en `fuerzas`, y las dos veces lo honesto fue decirlo en vez de inventar un criterio a
  posteriori que encajara con el resultado.
- **Pinta a tamaño real.** `arista` enseñaba las candidatas sobre fondo negro y todas se leían;
  `canal-vivo` las puso sobre 651 aristas y la mitad desaparecieron.
