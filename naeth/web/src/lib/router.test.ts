import { beforeEach, describe, expect, it, vi } from 'vitest'

// Contrato del router: las rutas en ingles desde la 2.2026.09.3 (15/09/2026), y las viejas en
// castellano REDIRIGIDAS, no rotas. Un marcador a `#/grafo/abc` o un `#/grafo?reset` escrito en
// una nota tienen que seguir llevando al mismo sitio.
//
// El modulo lee `location` y registra `hashchange` al importarse, y Vitest corre en `node`, asi
// que aqui se le da una `location` de mentira ANTES de importarlo (import dinamico, como en
// `layout-map.test.ts`). `replace` se espia para comprobar que la redireccion no deja el hash
// viejo en el historial.

function fakeLocation(hash: string) {
  const loc = { hash, replace: vi.fn((h: string) => { loc.hash = h }) }
  vi.stubGlobal('location', loc)
  vi.stubGlobal('addEventListener', vi.fn())
  return loc
}

async function load(hash: string) {
  vi.resetModules()
  const loc = fakeLocation(hash)
  const mod = await import('./router.svelte')
  return { ...mod, loc }
}

describe('legacyHash', () => {
  it('traduce las cinco vistas viejas y conserva id y query', async () => {
    const { legacyHash } = await load('')
    expect(legacyHash('#/inicio')).toBe('#/home')
    expect(legacyHash('#/grafo')).toBe('#/graph')
    expect(legacyHash('#/grafo/abc-123')).toBe('#/graph/abc-123')
    expect(legacyHash('#/grafo?reset')).toBe('#/graph?reset')
    expect(legacyHash('#/nueva')).toBe('#/new')
    expect(legacyHash('#/estado')).toBe('#/status')
    expect(legacyHash('#/ajustes')).toBe('#/settings')
  })

  it('deja en paz lo que ya es nuevo, `#/m/<id>` y lo desconocido', async () => {
    const { legacyHash } = await load('')
    expect(legacyHash('#/home')).toBeNull()
    expect(legacyHash('#/graph/abc')).toBeNull()
    expect(legacyHash('#/m/abc')).toBeNull()
    expect(legacyHash('#/loquesea')).toBeNull()
    expect(legacyHash('')).toBeNull()
  })
})

describe('route al cargar', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('un hash viejo se redirige con replace y la vista sale ya en ingles', async () => {
    const { route, loc } = await load('#/grafo/abc')
    expect(loc.replace).toHaveBeenCalledWith('#/graph/abc')
    expect(route.view).toBe('graph')
    expect(route.id).toBe('abc')
  })

  it('`#/m/<id>` abre la memoria y no redirige', async () => {
    const { route, loc } = await load('#/m/xyz')
    expect(loc.replace).not.toHaveBeenCalled()
    expect(route.view).toBe('memory')
    expect(route.id).toBe('xyz')
  })

  it('la query no decide la vista y lo desconocido cae a home', async () => {
    expect((await load('#/graph?reset')).route.view).toBe('graph')
    expect((await load('#/nada')).route.view).toBe('home')
    expect((await load('')).route.view).toBe('home')
  })
})

describe('navigate', () => {
  it('construye los hashes nuevos', async () => {
    const { navigate, loc } = await load('#/home')
    navigate('graph', 'abc')
    expect(loc.hash).toBe('#/graph/abc')
    navigate('memory', 'xyz')
    expect(loc.hash).toBe('#/m/xyz')
    navigate('settings')
    expect(loc.hash).toBe('#/settings')
  })
})
