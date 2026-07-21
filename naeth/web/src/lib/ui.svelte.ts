// Estado de UI transversal (responsive): el cajón (drawer) de la sidebar en móvil.
export const ui = $state<{ drawer: boolean }>({ drawer: false })
export function toggleDrawer() { ui.drawer = !ui.drawer }
export function closeDrawer() { ui.drawer = false }
