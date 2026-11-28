import type { DeepLinks, SecureStore, WindowControls } from '../../shared/bridge'

/**
 * Everything the UI needs from its host. Components use this and never `window.prepDeck`
 * directly, so the same renderer runs in Electron and in a browser.
 */
export interface Platform {
  kind: 'electron' | 'web'
  osLocale: string
  version: string
  /** Null in a browser: the browser draws its own window. */
  windowControls: WindowControls | null
  secureStore: SecureStore
  /** Null in a browser: there a link is pasted into Shared with me instead. */
  deepLinks: DeepLinks | null
}

/**
 * In a browser the refresh token will travel as an httpOnly cookie set by the backend, which
 * script cannot read at all. Until that exists, sessionStorage keeps it for the tab's lifetime.
 */
const webSecureStore: SecureStore = {
  async get() {
    try {
      return sessionStorage.getItem('prep-deck.refresh')
    } catch {
      return null
    }
  },
  async set(value) {
    sessionStorage.setItem('prep-deck.refresh', value)
  },
  async clear() {
    sessionStorage.removeItem('prep-deck.refresh')
  }
}

function detect(): Platform {
  const bridge = window.prepDeck
  if (bridge) {
    return {
      kind: 'electron',
      osLocale: bridge.locale || navigator.language,
      version: bridge.version || __APP_VERSION__,
      windowControls: bridge.window,
      secureStore: bridge.secureStore,
      deepLinks: bridge.deepLinks
    }
  }
  return {
    kind: 'web',
    osLocale: navigator.language,
    version: __APP_VERSION__,
    windowControls: null,
    secureStore: webSecureStore,
    deepLinks: null
  }
}

export const platform: Platform = detect()
