import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Naeth · visor v2
//  - DEV:  `vite` (puerto 5173) con proxy de /api al stack (FastAPI en 127.0.0.1:8800).
//  - PROD: `vite build` -> dist/, servido estático por FastAPI (ajuste del custom_route "/").
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
})
