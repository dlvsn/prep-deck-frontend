import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { productionCsp } from './build/csp'

const version = process.env.npm_package_version ?? '0.0.0'

/**
 * The renderer on its own, in a browser: the future web version. Nothing here knows about
 * Electron; the app finds no preload bridge and falls back to the web platform.
 */
export default defineConfig({
  root: resolve('src/renderer'),
  envDir: resolve('.'),
  resolve: {
    alias: { '@': resolve('src/renderer') }
  },
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), productionCsp()],
  build: {
    outDir: resolve('out/web'),
    emptyOutDir: true
  }
})
