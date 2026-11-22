import { create } from 'zustand'
import { api } from '@/api'
import type { Session, User } from '@/api/types'
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
  register(email: string, username: string, password: string): Promise<void>
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

export const useSession = create<SessionState>()((set, get) => {
  const begin = async (session: Session): Promise<void> => {
    await platform.secureStore.set(session.refreshToken)
    set({ status: 'authenticated', user: session.user, accessToken: session.accessToken })
  }
  const end = async (): Promise<void> => {
    await platform.secureStore.clear().catch(() => undefined)
    set({ status: 'anonymous', user: null, accessToken: null })
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

    register: async (email, username, password) => begin(await api.auth.register(email, username, password)),

    refresh: async () => {
      const token = await platform.secureStore.get().catch(() => null)
      if (!token) return false
      try {
        await begin(await api.auth.refresh(token))
        return true
      } catch {
        await end()
        return false
      }
    },

    logout: async () => {
      await api.auth.logout().catch(() => undefined)
      await end()
    },

    expire: () => void end()
  }
})
