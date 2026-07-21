// Tema claro/oscuro: persistido, respeta el sistema, aplicado en <html data-theme>.
type Theme = 'dark' | 'light'
const KEY = 'naeth-theme'

function initial(): Theme {
  const saved = localStorage.getItem(KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const theme = $state<{ value: Theme }>({ value: initial() })

function apply(t: Theme) {
  document.documentElement.dataset.theme = t
}
apply(theme.value)

export function setTheme(t: Theme, persist = true) {
  theme.value = t
  apply(t)
  if (persist) localStorage.setItem(KEY, t)
}
export function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}
export const themeIdx = () => (theme.value === 'dark' ? 0 : 1)

// si el usuario nunca tocó el toggle, seguir el sistema
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem(KEY)) setTheme(e.matches ? 'dark' : 'light', false)
})
