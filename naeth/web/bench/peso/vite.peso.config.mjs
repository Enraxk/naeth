import { defineConfig } from 'vite'
const entry = process.env.PESO_ENTRY
export default defineConfig({
  logLevel: 'error',
  build: { outDir: 'out/' + entry.replace('.js',''), emptyOutDir: true, target: 'es2022',
    lib: { entry: new URL(entry, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), formats: ['es'], fileName: 'bundle' },
    rollupOptions: { external: [] } },
})
