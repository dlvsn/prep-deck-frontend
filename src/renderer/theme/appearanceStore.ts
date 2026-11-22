import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { platform } from '@/app/platform'
import type { Language } from '@/i18n'
import { isAccent, type Accent, type Mode } from './accents'

interface AppearanceState {
  mode: Mode
  accent: Accent
  language: Language
  setMode(mode: Mode): void
  setAccent(accent: Accent): void
  setLanguage(language: Language): void
}

/** First launch: mode from the OS, Mint, and Ukrainian only when the OS speaks it. */
const initial = (): Pick<AppearanceState, 'mode' | 'accent' | 'language'> => ({
  mode: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  accent: 'mint',
  language: platform.osLocale.toLowerCase().startsWith('uk') ? 'uk' : 'en'
})

/**
 * The user's look and language, kept in localStorage under the key theme-boot.js reads before
 * the first paint. app/settingsSync.ts keeps it in step with the user's settings on the server.
 */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      ...initial(),
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setLanguage: (language) => set({ language })
    }),
    {
      name: 'prep-deck.appearance',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ mode, accent, language }) => ({ mode, accent, language }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppearanceState>
        return {
          ...current,
          mode: p.mode === 'dark' || p.mode === 'light' ? p.mode : current.mode,
          accent: isAccent(p.accent) ? p.accent : current.accent,
          language: p.language === 'en' || p.language === 'uk' ? p.language : current.language
        }
      }
    }
  )
)
