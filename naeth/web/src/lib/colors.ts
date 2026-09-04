import { themeIdx } from './theme.svelte'

// Color = significado, SOLO en iconos. Hoja=tipo, carpeta=proyecto. [oscuro, claro].
type Pair = [string, string]
type Meta = { icon: string; c: Pair }

export const TYPE: Record<string, Meta> = {
  fact: { icon: 'file-text', c: ['#55aea8', '#2c7871'] },
  observation: { icon: 'eye', c: ['#bca566', '#905a30'] },
  decision: { icon: 'git-commit-horizontal', c: ['#b69de2', '#7e58c1'] },
  preference: { icon: 'heart', c: ['#da9db2', '#b4537e'] },
  // Aqui vivian `learning` y `error`, retirados el 28/08/2026 al cerrar el vocabulario en los
  // cuatro de la convencion: se ofrecian en el editor y tenian CERO uso en 462 memorias. Es el
  // mismo caso que `ORIGIN_ICON`, retirado el 22/08 por ofrecer un mapa que nadie acertaba.
  // Un tipo que no este aqui cae al icono de `fact` por el `??` de `typeMeta`, asi que las dos
  // notas de `reference` que quedan vivas se siguen pintando, no desaparecen.
}

export const PROJECT: Record<string, Meta> = {
  naeth: { icon: 'database', c: ['#55aea8', '#2c7871'] },
  // El verde claro #16a34a se quedaba en 2.86:1 sobre la sidebar, bajo el 3:1 que piden los
  // elementos graficos. #15803d (el mismo que --ok en claro) sube a 4.3 sin cambiar de familia.
  // (Esta nota vivia en TYPE.learning, que se retiro el 28/08/2026.)
  gridwatch: { icon: 'zap', c: ['#6fb384', '#2e6a44'] },
  infra: { icon: 'server', c: ['#bc9a66', '#905a30'] },
  personal: { icon: 'users', c: ['#da9db2', '#b4537e'] },
  yogin: { icon: 'sparkles', c: ['#b69de2', '#7e58c1'] },
  ark: { icon: 'gamepad-2', c: ['#d89f79', '#bc6a3f'] },
  fplibre: { icon: 'graduation-cap', c: ['#a4b56f', '#4b6528'] },
  yosoysanas: { icon: 'music', c: ['#df8f99', '#b55353'] },
  gtfu: { icon: 'activity', c: ['#cf8dd9', '#893e91'] },
  whisper: { icon: 'mic', c: ['#a7aee6', '#625dbc'] },
  mandatum: { icon: 'book-open', c: ['#ba96de', '#8f59c0'] },
  ucraftengine: { icon: 'box', c: ['#db9984', '#9c5436'] },
  formacion: { icon: 'presentation', c: ['#95b56f', '#4b6528'] },
  skills: { icon: 'puzzle', c: ['#bcb266', '#815e2a'] },

  // --- Añadidos el 04/09/2026, al construir el grafo ---
  //
  // Faltaban CATORCE proyectos y entre ellos tres de los cuatro mas grandes, asi que 238 de las
  // 528 memorias (el 45% del corpus) se pintaban todas del mismo gris de reserva. En el arbol y
  // en las barras de Estado eso pasaba desapercibido porque el nombre va escrito al lado; en el
  // grafo no, porque alli el color ES la unica pista de a que proyecto pertenece un punto.
  //
  // ⚠ VEINTISEIS COLORES NO SE DISTINGUEN, y conviene saberlo antes de fiarse de este mapa. El
  // limite practico de una paleta categorica ronda la docena. El reparto de aqui prioriza que los
  // GRANDES se separen bien entre si, y acepta parecidos entre los de una o dos memorias, cuya
  // masa en pantalla es despreciable. Si algun dia hay que distinguir de verdad entre dos
  // proyectos pequeños, la respuesta no es un color mas: es filtrar.
  inkerlum: { icon: 'book-open', c: ['#8ea6d8', '#4864b1'] },
  eneko: { icon: 'house', c: ['#bb9e82', '#77492d'] },
  cenit: { icon: 'refresh', c: ['#da957f', '#9c5436'] },
  'job-search': { icon: 'search', c: ['#98cab7', '#1f604d'] },
  'research-harness': { icon: 'square-code', c: ['#b4a9d2', '#644497'] },
  'caja-pc': { icon: 'hash', c: ['#bdc0c5', '#56565b'] },
  enraxk: { icon: 'smile', c: ['#cbb48c', '#6c4d2a'] },
  fiscal: { icon: 'list-ordered', c: ['#90975b', '#4b6528'] },
  prompting: { icon: 'lightbulb', c: ['#7fb2ba', '#2c6575'] },
  'email-triage': { icon: 'list', c: ['#9baad0', '#4f4b8c'] },
  'escritura-a-mano': { icon: 'italic', c: ['#d4a8bb', '#813655'] },
  krepis: { icon: 'table', c: ['#9fb39f', '#3e5225'] },
  portfolio: { icon: 'check', c: ['#b2b2b2', '#575452'] },
  'tech-reborn': { icon: 'gamepad-2', c: ['#a0bf86', '#3e5225'] },
  // `ark` y `mandatum` de arriba ya no tienen ninguna memoria en el corpus. Se dejan: no estorban,
  // y retirarlos es una decision sobre proyectos, no sobre colores.
}

// Aqui vivia ORIGIN_ICON, que mapeaba `code` y `chat` a un icono. Retirado el 22/08/2026: eran los
// valores del esquema viejo `proyecto/origen`, derogado el 21/07/2026. Desde entonces el segundo
// nivel del path es el SUBTEMA, y medido contra el arbol vivo hay 46 subtemas distintos de los que
// **ninguno** casaba: las 411 memorias vigentes caian ya al icono de carpeta.
//
// Retirarlo no cambia nada de lo que se ve. Se prefiere eso a inflar el mapa a 46 entradas, que
// seria inventar una taxonomia visual que nadie ha pedido y que envejeceria igual de mal.

const FALLBACK: Meta = { icon: 'folder', c: ['#8a8e95', '#72767e'] }

export const typeMeta = (t: string): Meta => TYPE[t] ?? TYPE.fact
export const projMeta = (p: string): Meta => PROJECT[p] ?? FALLBACK
export const typeColor = (t: string) => typeMeta(t).c[themeIdx()]
export const projColor = (p: string) => projMeta(p).c[themeIdx()]
