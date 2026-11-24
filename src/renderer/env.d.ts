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
    /** Development only: every topic arrives with this role (owner, editor, viewer). */
    readonly VITE_FORCE_ROLE?: string
  }
}

export {}
