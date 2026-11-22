import { useEffect, useRef } from 'react'
import i18n from '@/i18n'
import { useAppearance } from '@/theme/appearanceStore'

/** Briefly puts a class on <html>, restarting it if the user clicks again within the window. */
function flashClass(name: string, ms: number, timers: Map<string, number>): void {
  const root = document.documentElement
  window.clearTimeout(timers.get(name))
  root.classList.remove(name)
  // Reading layout here restarts a CSS animation the class carries.
  void root.offsetWidth
  root.classList.add(name)
  timers.set(name, window.setTimeout(() => root.classList.remove(name), ms))
}

/**
 * Mirrors the appearance store onto <html> and i18next. Changes apply in place: no reload,
 * no remount, so an open card or a practice session survives a theme or language switch.
 */
export function AppearanceSync(): null {
  const { mode, accent, language } = useAppearance()
  const first = useRef(true)
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const root = document.documentElement
    if (!first.current) flashClass('theme-transition', 300, timers.current)
    root.dataset.mode = mode
    root.dataset.accent = accent
  }, [mode, accent])

  useEffect(() => {
    document.documentElement.lang = language
    if (i18n.language === language) return
    if (!first.current) flashClass('lang-switching', 160, timers.current)
    void i18n.changeLanguage(language)
  }, [language])

  useEffect(() => {
    first.current = false
  }, [])

  return null
}
