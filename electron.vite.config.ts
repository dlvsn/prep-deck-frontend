import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { productionCsp } from './build/csp'

const version = process.env.npm_package_version ?? '0.0.0'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // Defaults spelled out: the renderer is a plain web app rooted here, so the same sources
    // also run in a browser through vite.web.config.ts.
    root: resolve('src/renderer'),
    envDir: resolve('.'),
    resolve: {
      alias: { '@': resolve('src/renderer') }
    },
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [react(), productionCsp()],
    build: {
      rollupOptions: { input: resolve('src/renderer/index.html') }
    }
  }
})
