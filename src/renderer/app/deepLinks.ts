import { create } from 'zustand'
import { platform } from './platform'

interface DeepLinkState {
  /** A prepdeck:// link not acted on yet: it waits here through the login screen. */
  pending: string | null
  /** Hands the waiting link over once, or null. */
  take(): string | null
}

export const useDeepLinks = create<DeepLinkState>()((set, get) => ({
  pending: null,
  take: () => {
    const link = get().pending
    set({ pending: null })
    return link
  }
}))

const receive = (url: string | null): void => {
  if (url) useDeepLinks.setState({ pending: url })
}

// The link the app was started with, and every one opened while it runs.
void platform.deepLinks?.take().then(receive)
platform.deepLinks?.onLink(receive)
