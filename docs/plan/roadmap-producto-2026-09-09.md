# Roadmap: de montaje personal a producto

**Abierto el 09/09/2026.** Ordena en el tiempo lo que [`mapa.md`](mapa.md) solo inventaria. El mapa
dice qué hay abierto y no prioriza; esto dice **en qué orden y por qué ese orden**.

## El objetivo, dicho por Eneko el 09/09

Por este orden: **que lo use otra gente**, **que abra puertas** (trabajo, consultoría), y **el dinero
al final**. La duda entre empezar por usuarios o por puertas no hay que resolverla ahora, y la razón
está en la estructura del propio camino: **las dos primeras fases son las mismas para las dos metas**.
La bifurcación llega en la fase 3.

Que el dinero vaya último sí decide cosas hoy: **la investigación de costes de alojamiento no es
urgente** y se aparca, y la idea K de la ronda del 06/09 (vender lectura de `gridwatch/*` a un
cliente) deja de ser la vía rápida a explorar.

## El principio que gobierna todo

> **El producto final tiene que ser el mismo que Eneko usa y sobre el que sigue desarrollando.**

No hay una rama "producto" y otra "mi instalación": hay un producto, y lo suyo es **la instancia de
referencia**. De ahí sale el orden entero de este documento: la fase 1 no es preparar algo para otros,
es **separar la plataforma de la instancia**, y esa separación hoy no existe en ningún sitio.

## De dónde sale cada afirmación

Todo lo que se da por cierto aquí está verificado contra el código el 09/09, no contra el corpus:
[`../discovery/cenit-verificacion-2026-09-09.md`](../discovery/cenit-verificacion-2026-09-09.md).
El diagnóstico en una frase: **Naeth está a un cambio de fichero compose de ser autónomo; CENIT no es
una distribución, es el despliegue de una persona guardado en git.**

---

## Fase 0 · Que no se rompa nada [HECHA el 09/09]

Antes de mover nada, cerrar lo que estaba mal y podía morder. Entregado en `18f6128` de CENIT: la
config decía que AMP va sin forward-auth desde hacía tres semanas, y quien se fiara dejaba ese panel
público. Cinco copias de la premisa falsa corregidas, y dos tests genéricos para que el siguiente
inquilino herede la vigilancia.

## Fase 1 · Separar la plataforma de la instancia

**Es el trabajo número uno pase lo que pase**, y no porque lo pida el producto: lo pide el principio
de arriba. Mientras el despliegue personal esté dentro del repo, "la plataforma" no existe como cosa
separable.

- `core/config.yaml` pasa a `config.example.yaml`, con el real gitignorado. Hoy lleva dentro el
  `zone_id` de Cloudflare, dos UUID de túnel, `ssh: root@192.168.1.60`, tres IP de LAN y una MAC.
- Los dos bind mounts a `C:\Users\eneki\.cloudflared\<uuid>.json` pasan a variable.
- La ruta DPAPI de `secrets/load-age-key.ps1` deja de estar fijada, y **se versiona el cargador de
  Linux** (`sops-env.sh` sourcea `/etc/cenit/load-age-key.sh`, que hoy no está en el repo).

**Entregable verificable**: el repo de CENIT no contiene ni un dato del despliegue de Eneko, y su
instalación **sigue arrancando igual** con su config local fuera de git. Lo segundo es la prueba de
verdad: si arranca solo en su máquina, no se ha separado nada.

⚠ El historial de git conserva esos valores aunque el fichero actual quede limpio. Antes de hacer
público el repo (fase 4) hay que decidir entre reescribir la historia o asumir que quedan expuestos.

## Fase 2 · Naeth instalable por un desconocido

La fase barata, y la que convierte "esto es mi montaje" en "esto se instala". **No toca código de
aplicación**: es compose y documentación.

- Un compose que defina su propio Postgres en vez de apuntar a `modules-db`, que vive en CENIT.
- Sin `cenit-net` como red externa.
- Los cinco `${VAR:?}` de fallo duro pasan a tener valor por defecto, y `NAETH_DSN` deja de ser un
  literal para ser variable.
- Un `.env.example` y un Quickstart en el README, que hoy dice justo lo contrario ("This is a module,
  not a standalone app").

**Entregable verificable**: en una máquina limpia, `docker compose up` levanta Naeth con su base, su
worker y su visor en el 8801, sin CENIT y sin cuenta de Cloudflare. Se prueba de verdad, no se
razona: contenedor limpio, repo recién clonado.

**Qué se pierde en ese modo y hay que decir en el README**: exposición pública, SSO, OAuth para
claude.ai y failover. **Qué se conserva**: las nueve tools MCP, la recuperación híbrida, el visor, el
grafo y el worker. Para un usuario local, eso ya es el producto entero.

---

## Aquí se bifurca

Las fases 1 y 2 sirven a las dos metas. A partir de aquí el orden depende de cuál pese más, y **la
decisión se puede tomar cuando se llegue**, con las dos primeras ya hechas.

### Si pesa "que abra puertas" → primero la fase 4, luego la 3

### Si pesa "que lo use otra gente" → primero la fase 3, luego la 4

---

## Fase 3 · Que Naeth sepa quién eres

Prerrequisito de todo lo multi-usuario, y **la mitad de arriba ya está hecha sin saberlo**: el proxy
inyecta `X-Auth-Request-User`, `-Email` y `-Preferred-Username` en la petición que entra a Naeth, y el
código no lee ninguna. Medido: una petición con un email inventado devuelve 200.

- **Separar el visor del loopback**, que hoy son el mismo proceso y el mismo puerto. Mientras lo sean,
  el código no puede distinguir "Eneko autenticado por SSO" de "cualquier cosa que corra en esta
  máquina".
- Que las escrituras del visor registren **quién**, en vez de la constante literal `_HUMAN_AUTHOR`.

**Entregable verificable**: una nota escrita desde el visor queda firmada con la persona, y la misma
escritura por loopback se distingue de ella en el dato, no solo en el `zone`.

⚠ Lo caro no es esto: es la fase 5. Esta fase se puede entregar sola y ya aporta (saber quién escribe
en un corpus de un solo usuario también vale).

## Fase 4 · La cara pública

- **`naeth.dev`**: la definición del 26/08, el símbolo, el enlace al repo y una demo. El dominio ya
  está activo en Cloudflare, así que Pages sale gratis y sin infraestructura nueva.
- **El repo de CENIT, público** (hoy es privado; Naeth ya lo es). Depende entera de la fase 1.
- ⚠ **Lo que se enseña es una demo, nunca el corpus de Eneko.** Su valor viene de escribir con
  franqueza sobre precios, clientes y personas, y eso no sale de casa.

**Entregable verificable**: alguien que no conoce el proyecto entra en `naeth.dev`, entiende qué es en
menos de un minuto, y puede instalarlo siguiendo el Quickstart de la fase 2. Sin la fase 2, esta
página deja la visita a medias.

## Fase 5 · El segundo usuario

La cara cara, y la que el 09/09 quedó medida: **barato en la identidad, caro en los datos**. Cero
columnas de propietario en las diez tablas de dominio, cero `ROW LEVEL SECURITY`, y **31 consultas
contra `memory`/`memory_current` en `app/core.py` que hoy no filtran por nadie**, a tocar una a una.

Más una migración de columna coordinada entre los dos nodos del failover, que obliga a ir `finally`
primero y el PC después. Y antes de nada, tres preguntas de diseño sin responder de la ronda del
06/09: dónde vive la identidad, qué le hace eso al `sync.py` de CENIT (que aborta ante cualquier
tabla sin clasificar), y **qué es exactamente una "nota conjunta"**, que son tres diseños distintos y
solo uno es barato.

**Entregable verificable**: Tania escribe y lee su corpus, sin ver el de Eneko, en la misma
instalación. **Y treinta días después sigue usándolo**, que es la única medición que dice si esto es
un producto o una herramienta personal excelente.

---

## Lo que NO entra, y por qué

| Qué | Por qué no |
|---|---|
| **Alojamiento de pago** | El dinero va último. Exige una investigación de costes que se aparca |
| **La idea K** (lectura para un cliente) | Era la vía rápida al dinero, y el dinero ya no es la meta primera |
| **Reescribir el reconciler** | Genera un fichero de 29 líneas y no instala nada, pero el producto no lo necesita: la fase 2 va por compose |
| **La asimetría PC/VPS** | Real y vigente, pero es de la instancia de Eneko, no de la plataforma |
| **Multi-nodo para terceros** | Nadie que se lo instale va a tener dos nodos. El failover se queda como lujo de la instancia de referencia |

## Lo que sigue vivo en paralelo, porque Naeth es su herramienta diaria

Esto no es el roadmap del producto, pero no se para mientras el producto avanza:

- ⚠ **El grafo en el móvil**, reportado como "funciona fatal" el 08/09 y sin diagnosticar. El banco ya
  dio la señal: a 375 px la arista mediana mide 10,5 px y solo el 56% pasa el umbral.
- **La lista del grafo**: G-A y G-B medidas y sin entregar, G-H (el buscador) sin depender de nada.
- **F4, el pase de mantenimiento**, que según el mapa es la pieza que da contenido a F1 y F2.

## Los tres riesgos que pueden tumbar esto

1. **Que la fase 1 rompa la instalación de Eneko.** Es el riesgo más concreto y el más fácil de
   controlar: cada cambio se prueba arrancando su pila real antes de seguir.
2. **Que "instalable" se dé por bueno sin probarlo en una máquina limpia.** Todo el corpus está lleno
   de casos donde algo devolvió éxito y el efecto no ocurrió. La fase 2 se cierra probándola, no
   razonándola.
3. **Que se construya la fase 5 antes de saber si alguien lo quiere.** Es la más cara con diferencia.
   Tania usándolo treinta días es más información que cualquier diseño de multi-tenancy.
