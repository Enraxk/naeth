# Notas vigentes que describen un estado ya superado

Lista que se va llenando **durante el backfill del digest**, no una auditoría aparte. Sale sola:
escribir un digest obliga a leer la nota entera, y ahí se ve si lo que afirma sigue siendo verdad.

**Nada de esto se toca sin decisión de Eneko**: retirar o superseder es escritura de conocimiento,
no metadato. Lo que sí se hace al encontrarlas es **datar el digest de forma explícita** ("estado al
DD/MM"), para que al menos no engañen desde la búsqueda mientras esperan decisión.

| Memoria | Path | Qué afirma que ya no es cierto | Qué la contradice |
|---|---|---|---|
| `ac5b0ac1` · Naeth · visor (Paso 4/5) · estado al 01/07/2026 | `naeth/viewer` | Describe el visor **v1** (el HTML único sin build, `app/viewer/index.html`) como el estado del visor, con su "próximo paso". El v1 se conserva solo como rollback | `ba209da7`, que declara el **v2 desplegado en los dos nodos** desde el 22/08/2026 |
| `998bd8ba` · ESB Networks: cliente ancla de GridWatch | `gridwatch/commercial` | Presenta a ESB como **cliente ancla** y da un estado comercial de junio de 2026. El encuadre entero ha caducado | `730c44ab`: GridWatch **desaparece como marca**, MAC cierra en diciembre y no se habla con distribuidoras. `bd8acf3c` ya declara la pregunta de ESB "cerrada como irrelevante" |
| `bd8acf3c` · GridWatch · follow-up con Ed | `gridwatch/comms` | Su estado operativo es "**todo parado hasta mediados de agosto**" y el único hito con fecha es el 4 de agosto. Estamos a finales de agosto y esa ventana pasó | Nada la contradice: simplemente **caducó por calendario**. Es el caso más leve de los tres |

| `71cab2cf` · FPlibre: mapa y estado | `fplibre/status` | Ruta del proyecto en `E:\Documentos\Eneko\Proyectos`, que ya no existe. Último commit de mayo de 2026 | La mudanza a `F:\src`, que otras notas ya recogen |
| `dd587628` · UCraftEngine | `ucraftengine/status` | Misma ruta muerta. Por lo demás la nota es correcta: el proyecto sigue en pausa total | Ídem |
| `f3b318ee` · GTFU | `gtfu/status` | Misma ruta muerta, y dice que el README marca "sprint en curso" cuando está parado | Ídem |
| `0c660017` · situación fiscal y ventana de regularización | `fiscal/research` | Su bloque **PLAN ACORDADO** manda buscar asesor "esta semana" y trata el reloj del art. 27 LGT como activo. Ese plan está retirado | `aa8c700a`, del 19/08: Eneko **cierra el caso por decisión** y retira el plan, las cinco preguntas y el reloj. ⚠ Caso distinto a los demás: esa misma nota dice que la investigación **sigue valiendo como material**, solo se retira la obligación de actuar. No es candidata a tombstone |
| `e08c5a95` · perfil profesional para búsqueda de empleo | `job-search/profile` | Da un rango salarial de **28-40k al año** y un título objetivo de frontend. Ambos desfasados | `f0b13f09` (jul-2026) lo sitúa en **45-70k** y reencuadra el perfil como remoto para extranjero con seguridad y AI-infra. El digest lleva el aviso dentro |
| `0cce57f0` · slugs canónicos de proyecto | `naeth/conventions` | Su regla de path es **`ámbito/origen`** con `code`/`chat` en el segundo nivel. Esa convención está **muerta desde el 21/07** | `a4b58024`, el esquema canónico vigente: el segundo nivel es el **subtema temático en inglés**, y el origen se retiró porque ya lo registra `author`. ⚠ El resto de la nota (los once ámbitos, la norma de crecimiento, los slugs a no fragmentar) **sigue siendo válido**, así que tampoco es candidata a tombstone |
| `466013a2` · Naeth · visor v2 · editor (Milkdown), relaciones y panel de contexto | `naeth/viewer` | Es un **estado fechado el 01/07/2026** que se lee como el estado del editor. Lleva dentro pendientes que hoy no lo son, y le faltan dos meses de trabajo del visor | `ba209da7`, el **v2 desplegado en los dos nodos** desde el 22/08. ⚠ Es la hermana de `ac5b0ac1`: mismo path, misma fecha y mismo problema, así que conviene decidirlas juntas. Lo que la nota **decide** (que un `[[enlace]]` ES una relación del grafo, y que se respeta Markdown) sigue vigente: no es candidata a tombstone. El digest lleva el aviso dentro |

| `df2e3996` · Posicionamiento competitivo en DSOs españoles | `gridwatch/commercial` | Trata a los cuatro DSOs españoles como **objetivo comercial vivo** y da por abierta la ventana del RD 997/2025, con un score de presencia a mejorar. Ese encuadre ya no existe | `730c44ab`, el mismo que tumba a `998bd8ba`: GridWatch **desaparece como marca**, MAC cierra en diciembre y no se habla con distribuidoras. ⚠ Su **inteligencia de mercado sigue valiendo** (quién está atrincherado en cada DSO es un hecho, no un plan), así que lo caducado es el encuadre, no el dato |

| `9f5bef85` · Vault deprecado, Naeth como fuente de verdad | `naeth/conventions` | Lo que AFIRMA sigue siendo cierto (el vault está deprecado desde el 25/06), pero **da la dirección de Naeth como `naeth-local.enraxk.dev`**, que está muerta desde el cutover a CENIT del 17/07/2026. Quien la lea y la siga no llega a ninguna parte | El cutover del 17/07: hoy se entra por `memory.enraxk.dev/mcp?s=web` y por loopback `127.0.0.1:8801/mcp?s=code`. ⚠ **Caso distinto a los demás del registro**: aquí no caduca la afirmación, caduca un DATO OPERATIVO dentro de ella, y eso se arregla con un supersede corto |

| `82af06a7` · Limpieza C: y cajón `_legacy_C` | `infra/cleanup` | El borrado que narra es histórico y correcto, pero afirma en presente que **lo canónico vive en `E:\Documentos\Eneko\Proyectos`** | La mudanza a `F:\src`. ⚠ Mismo tipo que `9f5bef85`: no caduca la afirmación, caduca un dato dentro. Es además el primer caso CONFIRMADO del patrón de la ruta muerta, y confirma que hay que leerlas una a una: sus dos hermanas de `infra/cleanup` sí eran falsos positivos |
| `97422bc4` · Investigación de financiación: 30+ instrumentos | `gridwatch/commercial` | Su plan es un calendario de 2026 con fechas ya pasadas ("Inmediato: mar-mayo 2026") y trata a GridWatch como aplicante vivo | Caduca por dos vías a la vez: **el calendario** y `730c44ab`, que retira la marca. ⚠ Pero el **catálogo de instrumentos es material de referencia** que sobrevive al encuadre, así que aquí retirar sería perder trabajo caro |

| `d84ed061` · Yogin · vistas previas ENTREGADAS el 26/8 | `yogin/tech` | Afirma que **la fase 3, la foto propia, queda FUERA a propósito**. Se entregó al día siguiente | `dba2d913`, que describe esa fase 3 entregada el 27/8. ⚠ **Tipo nuevo aquí: no caduca por calendario ni por un dato, la desmiente otra nota VIGENTE que no la superseded.** Las dos salen juntas en una búsqueda y se contradicen. Es el coste que Naeth asume por no detectar conflictos: una contradicción que nadie marca es una que nadie ve |


## Un patrón, no solo casos sueltos: la ruta muerta

Medido el 29/08/2026: **22 memorias vigentes citan `E:\Documentos\Eneko\Proyectos`**, y **18 de ellas
no mencionan la ruta nueva `F:\src`** en ningún sitio.

⚠ **18 es el TECHO, no el número de notas rotas.** El filtro es automático y no distingue por qué se
cita la ruta. Al menos tres son legítimas: `1b993e86` va precisamente **sobre** esa ruta (es su tema),
y las dos de `infra/cleanup` describen limpiezas **históricas** donde esa era la ruta correcta en su
momento. Separar unas de otras exige leerlas, que es justo lo que el backfill hace de todas formas.

La consulta que las saca, para repetirla:

```sql
SELECT id, path, title FROM memory_current
WHERE strpos(content,'Documentos')>0 AND strpos(content,'Eneko')>0 AND strpos(content,'Proyectos')>0
  AND strpos(content, 'F:' || chr(92) || 'src') = 0;
```

## Qué hacer con ellas, cuando toque decidirlo

Tres salidas posibles, y no tiene por qué ser la misma para todas:

1. **Superseder** con una versión que diga "esto fue el estado en tal fecha, hoy manda X". Conserva
   el contenido histórico y deja de mentir. Es lo más caro pero lo más fiel.
2. **Tombstone**, si lo que cuenta ya no aporta nada y su sucesora lo cubre entero.
3. **Dejarla y confiar en el digest fechado**, si el valor está en el detalle histórico y el riesgo
   de confusión es bajo.

⚠ Ojo con la 1 y la 2: **hay 40 pares de supersession correctivos medidos en el corpus** (el hijo
desmiente al padre), así que el histórico ya se consulta sabiendo que puede estar refutado. El
problema de estas notas no es que existan, es que **son vigentes** y la búsqueda las devuelve como
verdad actual.
