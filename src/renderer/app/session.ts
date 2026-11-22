import { create } from 'zustand'
import { api } from '@/api'
import { authBridge } from '@/api/authBridge'
import { ApiError } from '@/api/http'
import type { Registration, Session, User } from '@/api/types'
import { platform } from './platform'

type Status = 'starting' | 'anonymous' | 'authenticated'

interface SessionState {
  status: Status
  user: User | null
  /** Kept in memory only; the refresh token goes to the platform's secure store. */
  accessToken: string | null
  /** Start-up: restores the session from the stored refresh token, if there is one. */
  restore(): Promise<void>
  login(login: string, password: string): Promise<void>
  /** Creates the account unconfirmed; the session comes later, with the emailed code. */
  register(email: string, username: string, password: string): Promise<Registration>
  /**
   * Checks the emailed code and returns the first session without entering the app yet: the
   * "Email confirmed" screen shows first, and its button calls {@link start}.
   */
  verifyEmail(email: string, code: string): Promise<Session>
  /** Enters the app with a session obtained elsewhere (the confirmation screen). */
  start(session: Session): Promise<void>
  /** A fresh access token from the stored refresh token; false when the session is over. */
  refresh(): Promise<boolean>
  logout(): Promise<void>
  /** The server refused the session: back to the login screen without asking it again. */
  expire(): void
}

let restoring: Promise<void> | null = null
const listeners = new Set<() => void>()
/** Called on log out and expiry, so caches holding the previous user's data are dropped. */
export const onSessionEnd = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

type UserListener = (user: User | null) => void | Promise<void>
const userListeners = new Set<UserListener>()
/**
 * Called with the user before the app shows for them, and with null when the session ends: for
 * state kept per user (the topic tree's last topic, the settings synced with the server). The app
 * waits for a returned promise, at most {@link USER_SETUP_TIMEOUT_MS}, so what it loads is in
 * place on the first screen.
 */
export const onSessionUser = (listener: UserListener): (() => void) => {
  userListeners.add(listener)
  return () => userListeners.delete(listener)
}

/** A slow server must not keep the user out of the app; past this, the app opens anyway. */
const USER_SETUP_TIMEOUT_MS = 2000

async function notifyUser(user: User | null): Promise<void> {
  const all = Promise.allSettled([...userListeners].map((listener) => listener(user)))
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, USER_SETUP_TIMEOUT_MS))])
}

export const useSession = create<SessionState>()((set, get) => {
  const begin = async (session: Session): Promise<void> => {
    await platform.secureStore.set(session.refreshToken)
    // The access token first: the listeners may call the API for this user.
    set({ accessToken: session.accessToken })
    await notifyUser(session.user)
    set({ status: 'authenticated', user: session.user, accessToken: session.accessToken })
  }
  const end = async (): Promise<void> => {
    await platform.secureStore.clear().catch(() => undefined)
    set({ status: 'anonymous', user: null, accessToken: null })
    void notifyUser(null)
    listeners.forEach((l) => l())
  }

  return {
    status: 'starting',
    user: null,
    accessToken: null,

    restore: async () => {
      // Once per start, even if React mounts twice in development: a second refresh could race
      // the first with the same refresh token.
      restoring ??= get()
        .refresh()
        .then((ok) => {
          if (!ok) set({ status: 'anonymous' })
        })
      return restoring
    },

    login: async (login, password) => begin(await api.auth.login(login, password)),

    register: (email, username, password) => api.auth.register(email, username, password),

    verifyEmail: (email, code) => api.auth.verifyEmail(email, code),

    start: (session) => begin(session),

    refresh: async () => {
      const token = await platform.secureStore.get().catch(() => null)
      if (!token) return false
      try {
        await begin(await api.auth.refresh(token))
        return true
      } catch (error) {
        // Only a refusal ends the session. Offline or a server hiccup keeps the stored token, so
        // the next start can try again instead of logging the user out.
        if (error instanceof ApiError && error.status === 401) await end()
        return false
      }
    },

    logout: async () => {
      const token = await platform.secureStore.get().catch(() => null)
      if (token) await api.auth.logout(token).catch(() => undefined)
      await end()
    },

    expire: () => void end()
  }
})

// The HTTP client asks the session for the token and for a refresh through this bridge.
authBridge.getAccessToken = () => useSession.getState().accessToken
authBridge.refresh = () => useSession.getState().refresh()
authBridge.onSessionExpired = () => useSession.getState().expire()
