# Fase 4.0 · El tope del digest y el orden del backfill

Medición del 28/08/2026, previa a construir nada. Cierra las dos preguntas que la fase 4 tenía
abiertas: **cuánto puede ocupar un digest** y **en qué orden se rellenan las 470 vigentes**.

El plan completo está en [`plan-fases-2026-08-28.md`](plan-fases-2026-08-28.md); la lista viva, en
[`pendientes.md`](pendientes.md).

---

## 1. El tope: 300 caracteres

### Cómo se decidió

No eligiendo entre 200, 300 y 400, sino redactando **24 digests reales** y midiendo lo que pedían.
Muestra estratificada por longitud sobre G1, determinista (`ntile(4)` sobre `chars`, 6 por cuartil
ordenados por id), de **590 a 7.569 caracteres** de nota. Tipos: 14 `fact`, 8 `decision`,
2 `observation`.

### Lo primero que salió: el digest satura

| Cuartil | Longitud de la nota | Digest, primera pasada |
|---|---|---|
| Q1 | 590-1.789 | 212-282 |
| Q2 | 2.240-3.066 | 296-314 |
| Q3 | 3.216-4.891 | 284-318 |
| Q4 | 4.919-7.569 | 321-338 |

La nota crece **13 veces** y el digest **1,6**. Entre Q2 y Q4, apenas 1,1. Una nota larga no tiene
más afirmaciones centrales: tiene más desarrollo de las mismas.

El techo del corpus refuerza esto. Ordenadas por tamaño, las vigentes van 36.266 · 8.461 · 7.937 ·
7.802 · 7.681 · 7.569. **La primera es un outlier de otra naturaleza** (una transcripción cruda de
Whisper de la reunión del 03/07), así que el techo real de una nota de conocimiento es ~8.500 y la
muestra ya lo cubría. No había un estrato mayor que probar.

### ⚠ El sesgo que apareció al verificar, y que invalida la cifra fácil

La tentación era tomar el p90 de esos 24 (**324**) como "lo que pide el corpus". **No vale.**

Al comprobar si la longitud seguía al número de frases, salió que no: los caracteres por frase van de
**71 a 159** (media 112, desviación 30). Pero **14 de los 24 digests caen entre 296 y 325**, con 2, 3
o 4 frases indistintamente. Los de dos frases las tenían de 156 caracteres; los de cuatro, de 78.
Escribiendo los 24 seguidos y midiendo, se ajustaba la frase para llenar el mismo espacio: es firma
de **anclaje**, no de contenido.

### La prueba que sí resiste el anclaje

En vez de generar más longitud libre (que heredaría el mismo sesgo), se **comprimieron los cinco
casos más largos** preguntando qué se perdía:

| id | Antes | Después | ¿Pierde una afirmación falsable? |
|---|---|---|---|
| `1112a864` | 338 | 283 | No (conserva las **cuatro** trampas) |
| `3de45cec` | 325 | 257 | No |
| `4f519d73` | 324 | 270 | No |
| `44d59a04` | 323 | 260 | No |
| `3ffa4b29` | 322 | 257 | No |

**El exceso era relleno.** Lo que se cayó fueron subordinadas y conectores, no contenido. Aplicada
la misma compresión a los 11 restantes que pasaban de 300, los 24 quedan en **min 212 · mediana 267
· máximo 296**, sin perder nada.

### Por qué 300 y no 350

Tres razones, en orden de peso:

1. **El máximo real medido es 296**, con los 24 ya calibrados. 300 deja margen justo, no holgura.
2. **Un tope alto se llena.** Está demostrado arriba sobre esta misma sesión: con espacio libre, la
   redacción converge al espacio, no al contenido.
3. **La asimetría, que es lo que lo decide.** El tope es un `CHECK`. **Subirlo después es gratis**
   (relajar un CHECK revalida las filas existentes y todas pasan, porque son más cortas). **Bajarlo
   no**: obligaría a reeditar a mano cada digest que lo violara. Empezar apretado es la opción
   reversible, igual que `warn` frente a `strict` en el enforce.

**Efecto en contexto**: `memory_search` con `k=10` pasa de unos 27.000 caracteres (media de contenido
2.686) a unos 3.800 con título y digest. Un **86% menos**.

---

## 2. El orden del backfill

### Los ejes, y el que se cayó al medirlo

| Eje | Reparto sobre las 470 | ¿Discrimina? |
|---|---|---|
| Citas entrantes (relaciones vigentes + `[[uuid]]`, sin autocitas) | 214 con 1+ · 104 con 2+ · 46 con 3+ | Sí |
| Versiones acumuladas detrás | 142 con 1+ · 64 con 2+ · 30 con 3+ | Sí |
| `*/status` (punto de entrada) | 32 | Sí |
| **Recencia** | 428 de 470 en los últimos 60 días | **No** |
| **Frecuencia de consulta** | no existe el dato | **No medible** |

**La recencia se cayó**: el corpus entero es de junio (42), julio (217) y agosto (211) de 2026, así
que "reciente" no separa nada. Es el mismo modo de fallo que la heurística de volumen de la fase 3.
Con ella dentro, el grupo intermedio se llevaba **368 de 470**; sin ella, el reparto es real.

**La frecuencia de consulta no se puede medir.** Comprobado con
`SELECT table_name FROM information_schema.tables WHERE table_schema='memory'`: las 15 tablas son
`memory`, `supersession`, `tombstone`, `relation`, `attachment`, `job`, las cuatro de OAuth, las dos
vistas del mapeo, `memory_current` y los dos backups. **Ninguna registra accesos ni búsquedas**, así
que no se usa un proxy inventado en su lugar.

### Los tres grupos

| Grupo | Regla | Notas | Media de caracteres |
|---|---|---|---|
| **G1, el núcleo** | `citas >= 3` o `*/status` o `versiones >= 3` | **96** | 3.554 |
| **G2, el cuerpo** | `citas >= 1` o `versiones >= 1` | **209** | 2.976 |
| **G3, la cola** | ni citada ni corregida nunca | **165** | 1.814 |

**Validación independiente**: la media de caracteres **desciende monótonamente** por grupo, y el
tamaño no se usó como criterio en ninguna de las tres reglas. Las notas que otras citan y que se han
corregido son también las más densas.

### El top-30, verificado a ojo

La lección de la fase 3 (una heurística sin verificar tenía **6% de precisión**) obliga a mirar el
resultado antes de gastar diez sesiones siguiéndolo. El top-30 sale: el valor de mercado de Eneko,
la reunión de GridWatch del 30/07, el equity y la posición en la NewCo, los `*/status` de Yogin,
Naeth, CENIT, skills y enraxk, el método del último metro, el cortafuegos nocturno, la auditoría de
seguridad del 26/07 y el failover local-preferente. **Ni una nota irreconocible.**

Sesgo observado y aceptado: **Inkerlum ocupa 7 de los 30**, porque su lore se cita densamente entre
sí. Son centrales de verdad en el grafo, y además las más cortas (619-969), así que son las más
baratas de resumir. No distorsiona el orden.

---

## 3. Lo que queda hecho para 4.7

Los **24 digests de la muestra están escritos y calibrados**, en
[`digests-g1.tsv`](digests-g1.tsv) (`id-corto<TAB>digest`). Son la primera tanda de G1, no material
de prueba desechable.

⚠ **`1112a864` hay que revisarlo antes de escribirlo**: su digest se redactó sobre una lectura
**parcial** de la nota (la salida se truncó a 160 líneas). Las cuatro trampas que cita están
verificadas, pero la nota puede tener más abajo algo que merezca el digest por delante.

⚠ **No se han escrito en la base**: la columna no existe hasta 4.1, y el `UPDATE` del backfill va en
los **dos** nodos (`sync.py:119-127`, el merge no propaga columnas no monótonas).
