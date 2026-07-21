// Fechas en el formato regional del sistema (Windows); locale por defecto.
export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : ''
export const fmtLag = (s?: number | null) =>
  s == null ? '—' : s >= 1 ? `${s.toFixed(1)} s` : `${(s * 1000).toFixed(0)} ms`
