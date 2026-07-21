import { themeIdx } from './theme.svelte'

// Color = significado, SOLO en iconos. Hoja=tipo, carpeta=proyecto. [oscuro, claro].
type Pair = [string, string]
type Meta = { icon: string; c: Pair }

export const TYPE: Record<string, Meta> = {
  fact: { icon: 'file-text', c: ['#38d3c9', '#0d9488'] },
  observation: { icon: 'eye', c: ['#e0b84b', '#b45309'] },
  decision: { icon: 'git-commit-horizontal', c: ['#b58cff', '#7c3aed'] },
  preference: { icon: 'heart', c: ['#f48fb1', '#db2777'] },
  learning: { icon: 'lightbulb', c: ['#5ad17e', '#16a34a'] },
  error: { icon: 'triangle-alert', c: ['#f0686b', '#dc2626'] },
}

export const PROJECT: Record<string, Meta> = {
  naeth: { icon: 'database', c: ['#38d3c9', '#0d9488'] },
  gridwatch: { icon: 'zap', c: ['#5ad17e', '#16a34a'] },
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

export const ORIGIN_ICON: Record<string, string> = {
  code: 'square-terminal',
  chat: 'message-circle',
}

const FALLBACK: Meta = { icon: 'folder', c: ['#8a929e', '#6b7280'] }

export const typeMeta = (t: string): Meta => TYPE[t] ?? TYPE.fact
export const projMeta = (p: string): Meta => PROJECT[p] ?? FALLBACK
export const typeColor = (t: string) => typeMeta(t).c[themeIdx()]
export const projColor = (p: string) => projMeta(p).c[themeIdx()]
