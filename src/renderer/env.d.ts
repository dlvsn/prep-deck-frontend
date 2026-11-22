/// <reference types="vite/client" />
import type { PrepDeckBridge } from '../shared/bridge'

declare global {
  interface Window {
    /** Present only inside Electron; the web build runs without it. */
    readonly prepDeck?: PrepDeckBridge
  }

  const __APP_VERSION__: string

  interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_USE_MOCKS: string
  }
}

export {}
