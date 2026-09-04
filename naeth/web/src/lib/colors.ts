import { themeIdx } from './theme.svelte'

// Color = significado, SOLO en iconos. Hoja=tipo, carpeta=proyecto. [oscuro, claro].
type Pair = [string, string]
type Meta = { icon: string; c: Pair }

export const TYPE: Record<string, Meta> = {
  fact: { icon: 'file-text', c: ['#38d3c9', '#0d9488'] },
  observation: { icon: 'eye', c: ['#e0b84b', '#b45309'] },
  decision: { icon: 'git-commit-horizontal', c: ['#b58cff', '#7c3aed'] },
  preference: { icon: 'heart', c: ['#f48fb1', '#db2777'] },
  // Aqui vivian `learning` y `error`, retirados el 28/08/2026 al cerrar el vocabulario en los
  // cuatro de la convencion: se ofrecian en el editor y tenian CERO uso en 462 memorias. Es el
  // mismo caso que `ORIGIN_ICON`, retirado el 22/08 por ofrecer un mapa que nadie acertaba.
  // Un tipo que no este aqui cae al icono de `fact` por el `??` de `typeMeta`, asi que las dos
  // notas de `reference` que quedan vivas se siguen pintando, no desaparecen.
}

export const PROJECT: Record<string, Meta> = {
  naeth: { icon: 'database', c: ['#38d3c9', '#0d9488'] },
  // El verde claro #16a34a se quedaba en 2.86:1 sobre la sidebar, bajo el 3:1 que piden los
  // elementos graficos. #15803d (el mismo que --ok en claro) sube a 4.3 sin cambiar de familia.
  // (Esta nota vivia en TYPE.learning, que se retiro el 28/08/2026.)
  gridwatch: { icon: 'zap', c: ['#5ad17e', '#15803d'] },
  infra: { icon: 'server', c: ['#e0a64b', '#b45309'] },
  personal: { icon: 'users', c: ['#f48fb1', '#db2777'] },
  yogin: { icon: 'sparkles', c: ['#b58cff', '#7c3aed'] },
  ark: { icon: 'gamepad-2', c: ['#ff9d5c', '#ea580c'] },
  fplibre: { icon: 'graduation-cap', c: ['#b6d35a', '#4d7c0f'] },
  yosoysanas: { icon: 'music', c: ['#ff7a8a', '#dc2626'] },
  gtfu: { icon: 'activity', c: ['#e879f9', '#a21caf'] },
  whisper: { icon: 'mic', c: ['#9aa5ff', '#4f46e5'] },
  mandatum: { icon: 'book-open', c: ['#c084fc', '#9333ea'] },
  ucraftengine: { icon: 'box', c: ['#ff8f6b', '#c2410c'] },
  formacion: { icon: 'presentation', c: ['#9bd45a', '#4d7c0f'] },
  skills: { icon: 'puzzle', c: ['#e0cf4b', '#a16207'] },

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
  inkerlum: { icon: 'book-open', c: ['#7aa2f7', '#1d4ed8'] },
  eneko: { icon: 'house', c: ['#d4a373', '#92400e'] },
  cenit: { icon: 'refresh', c: ['#ff8a65', '#c2410c'] },
  'job-search': { icon: 'search', c: ['#8de0c0', '#047857'] },
  'research-harness': { icon: 'square-code', c: ['#b3a1e6', '#5b21b6'] },
  'caja-pc': { icon: 'hash', c: ['#c0c5ce', '#52525b'] },
  enraxk: { icon: 'smile', c: ['#e6c07b', '#854d0e'] },
  fiscal: { icon: 'list-ordered', c: ['#a8b545', '#4d7c0f'] },
  prompting: { icon: 'lightbulb', c: ['#6ec7d4', '#0e7490'] },
  'email-triage': { icon: 'list', c: ['#8fa8e8', '#3730a3'] },
  'escritura-a-mano': { icon: 'italic', c: ['#e8a0bf', '#9d174d'] },
  krepis: { icon: 'table', c: ['#9dbf9e', '#3f6212'] },
  portfolio: { icon: 'check', c: ['#b8b8b8', '#57534e'] },
  'tech-reborn': { icon: 'gamepad-2', c: ['#a3d977', '#3f6212'] },
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

const FALLBACK: Meta = { icon: 'folder', c: ['#8a929e', '#6b7280'] }

export const typeMeta = (t: string): Meta => TYPE[t] ?? TYPE.fact
export const projMeta = (p: string): Meta => PROJECT[p] ?? FALLBACK
export const typeColor = (t: string) => typeMeta(t).c[themeIdx()]
export const projColor = (p: string) => projMeta(p).c[themeIdx()]
