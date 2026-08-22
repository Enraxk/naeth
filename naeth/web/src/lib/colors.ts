import { themeIdx } from './theme.svelte'

// Color = significado, SOLO en iconos. Hoja=tipo, carpeta=proyecto. [oscuro, claro].
type Pair = [string, string]
type Meta = { icon: string; c: Pair }

export const TYPE: Record<string, Meta> = {
  fact: { icon: 'file-text', c: ['#38d3c9', '#0d9488'] },
  observation: { icon: 'eye', c: ['#e0b84b', '#b45309'] },
  decision: { icon: 'git-commit-horizontal', c: ['#b58cff', '#7c3aed'] },
  preference: { icon: 'heart', c: ['#f48fb1', '#db2777'] },
  // El verde claro #16a34a se quedaba en 2.86:1 sobre la sidebar, bajo el 3:1 de elementos
  // graficos. #15803d (el mismo que --ok en claro) sube a 4.3 sin cambiar de familia.
  learning: { icon: 'lightbulb', c: ['#5ad17e', '#15803d'] },
  error: { icon: 'triangle-alert', c: ['#f0686b', '#dc2626'] },
}

export const PROJECT: Record<string, Meta> = {
  naeth: { icon: 'database', c: ['#38d3c9', '#0d9488'] },
  gridwatch: { icon: 'zap', c: ['#5ad17e', '#15803d'] },   // ver la nota en TYPE.learning
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
