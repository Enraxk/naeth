import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Naeth · visor v2
//  - DEV:  `vite` (puerto 5173) con proxy de /api al stack (FastAPI en 127.0.0.1:8800).
//  - PROD: `vite build` -> dist/, servido estático por FastAPI (NAETH_VIEWER_DIR -> dist/).
//
// El `defineConfig` viene de `vitest/config` y no de `vite`: es el mismo, pero además tipa el
// bloque `test` de abajo. Los tests se configuran AQUI a proposito, y no en un vitest.config.json:
// el .gitignore de la raiz tiene `*.json` (por las credenciales de cloudflared) con excepciones
// una a una, asi que un .json nuevo nace sin versionar y el runner no arrancaria en otro clon.
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  // Crepe (Milkdown) usa Vue por dentro: definir sus feature flags silencia el aviso
  // y mejora el tree-shaking.
  define: {
    __VUE_OPTIONS_API__: 'false',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8800',
    },
  },
  // Solo `.test.ts`: lo que se prueba aqui es LOGICA PURA (resolucion de wikilinks, agrupado del
  // arbol), sin DOM ni red. Por eso no hay jsdom ni @testing-library, que serian dependencias
  // grandes para no probar nada mas. Los componentes se verifican en el navegador.
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
