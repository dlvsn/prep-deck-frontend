import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import uk from './uk.json'

export type Language = 'en' | 'uk'

export const resources = {
  en: { translation: en },
  uk: { translation: uk }
} as const

/**
 * Started with whatever language theme-boot.js already put on <html>, so the first render is in
 * the right language; AppearanceSync keeps the two in step from then on.
 */
const startLanguage: Language = document.documentElement.lang === 'uk' ? 'uk' : 'en'

void i18n.use(initReactI18next).init({
  resources,
  lng: startLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export default i18n
