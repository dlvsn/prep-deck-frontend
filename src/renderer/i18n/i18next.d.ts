import 'i18next'
import type en from './en.json'

// Typed keys: t('nav.myTopic') with a typo fails the type check instead of rendering the key.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof en }
  }
}
