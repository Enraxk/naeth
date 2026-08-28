<script lang="ts" module>
  /**
   * La marca de Naeth, dibujada. Cerrada en Claude Design en cuatro rondas: simbolo (3a), wordmark
   * (6a), color (7a) y lockup (11c). El detalle y el porque de cada eleccion, en la memoria de
   * `naeth/conventions`.
   *
   * TRES COSAS QUE NO HAY QUE DESHACER SIN LEER AQUELLO:
   *
   * 1. `fill="currentColor"` y ni un color escrito. La ronda de color eligio "tinta pura": la marca
   *    NO tiene color propio, toma la tinta del texto en cada tema. Medido: 14,71:1 en claro y
   *    13,31:1 en oscuro, contra los tokens que el visor ya usa. Se descarto el acento azul porque
   *    daba 4,82 en claro y se emborronaba a 16 px.
   *
   * 2. El simbolo y la inicial del lockup NO son el mismo dibujo, y es deliberado. El simbolo suelto
   *    mide 20 de alto y la inicial del lockup 24, los dos con trazo 3, asi que la inicial va un
   *    punto mas ligera. Es el precio de que el trazo case con el resto de la palabra. Unificarlos
   *    "por limpieza" rompe justo lo que se pago por conseguir.
   *
   * 3. La junta de 2 unidades en mitad de la diagonal es el dibujo, no un fallo de precision: los
   *    dos montantes son la misma pieza en dos momentos, y la costura se deja a la vista.
   *
   * Suelos: el simbolo aguanta 16 px; el lockup, 24 px de alto (a esa altura la abertura de la «a»
   * mide 2 px reales y el ojo de la «e», 3).
   */

  /**
   * Rejilla de 24, montantes de 3x20 en x=2 y x=19, diagonal de grosor 3 partida por la junta.
   *
   * ⚠ ESTE PATH VIVE EN TRES SITIOS, y no hay forma de evitarlo: aqui, en el data URI del favicon
   * (`index.html`, que no puede referenciar un fichero porque la raiz de `dist/` no se sirve) y en
   * `docs/img/naeth-symbol*.svg`, que el README necesita como ficheros de verdad porque un SVG
   * cargado por `<img>` no hereda `currentColor`. Si el dibujo cambia, cambian los tres.
   * Comprobado el 28/08/2026 que los tres son identicos caracter a caracter.
   */
  const SYMBOL = 'M2 2h3v20H2zM19 2h3v20h-3zM2 2h3l7.65 9H9.65zM11.35 13h3L22 22h-3z'

  /** La N del lockup: redibujada en la rejilla, NO escalada, para que su trazo siga siendo 3. */
  const LOCKUP_N = 'M2 -2h3v24H2zM23 -2h3v24h-3zM2 -2h3l9.63 11H11.63zM13.38 11h3L26 22h-3z'

  /** «aeth» en caja baja, mismo alfabeto construido. */
  const LOCKUP_AETH =
    'M36 7h3v15h-3zM26 7h10v3H26zM26 12h10v3H26zM26 12h3v10H26zM26 19h13v3H26zM45 7h3v15h-3zM45 7h13v3H45zM55 7h3v6h-3zM45 13h13v3H45zM45 19h13v3H45zM64 7h12v3H64zM68.5 2h3v20h-3zM82 2h3v20h-3zM92 7h3v15h-3zM82 7h13v3H82z'

  export type BrandVariant = 'symbol' | 'lockup'
</script>

<script lang="ts">
  let {
    variant = 'lockup',
    height = 22,
    label,
  }: { variant?: BrandVariant; height?: number; label?: string } = $props()

  // Sin `label` es decorativa y se oculta al lector de pantalla, que es el caso normal: va dentro de
  // un boton que ya se anuncia solo. Con `label` se anuncia ella.
  const a11y = $derived(
    label
      ? ({ role: 'img' as const, 'aria-label': label })
      : ({ 'aria-hidden': 'true' as const }),
  )
</script>

{#if variant === 'symbol'}
  <svg
    {...a11y}
    class="brand"
    viewBox="0 0 24 24"
    fill="currentColor"
    style="height: {height}px"
  >
    <path d={SYMBOL} />
  </svg>
{:else}
  <!-- El viewBox arranca en -2 porque la inicial sobresale por arriba de la altura de mayuscula. -->
  <svg
    {...a11y}
    class="brand"
    viewBox="0 -2 99 24"
    fill="currentColor"
    style="height: {height}px"
  >
    <g transform="translate(-2,0)"><path d={LOCKUP_N} /></g>
    <g transform="translate(4,0)"><path d={LOCKUP_AETH} /></g>
  </svg>
{/if}

<style>
  /* `block` para que no arrastre el hueco de linea base de los inline, que descuadraria la barra. */
  .brand { display: block; width: auto; flex: none; }
</style>
