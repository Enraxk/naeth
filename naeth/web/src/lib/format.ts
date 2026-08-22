import type { Author } from './types'

// Fechas en el formato regional del sistema (Windows); locale por defecto.
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''
export const fmtLag = (s?: number | null) =>
  s == null ? '-' : s >= 1 ? `${s.toFixed(1)} s` : `${(s * 1000).toFixed(0)} ms`

/**
 * Autoria en forma corta para la cabecera: `claude-code · opus-5`.
 *
 * El prefijo `claude-` del modelo se quita porque el producto ya lo dice: `claude-code ·
 * claude-opus-5` repite la palabra dos veces en una linea de 12px. Lo que distingue una nota de
 * otra es el par (donde se escribio, con que modelo).
 *
 * Degrada en dos escalones, y esto importa porque la mitad del corpus es anterior al Paso 10:
 * sin modelo queda solo el producto, y sin autoria no se pinta nada (el llamante omite tambien su
 * separador, en vez de dejar un `·` suelto).
 *
 * Naeth es monousuario, asi que `actor: 'human'` solo puede ser Eneko. Es una decision, no un dato
 * que venga de la base: el `author` no guarda nombre de persona.
 */
export function fmtAuthor(a?: Author | null): string {
  if (!a) return ''
  if (a.actor === 'human') return 'Eneko'
  const product = a.product?.trim()
  if (!product) return ''
  const model = a.model?.trim()
  return model ? `${product} · ${model.replace(/^claude-/, '')}` : product
}
