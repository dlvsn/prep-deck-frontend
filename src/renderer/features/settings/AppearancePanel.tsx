import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language } from '@/i18n'
import { ACCENTS, type Mode } from '@/theme/accents'
import { useAppearance } from '@/theme/appearanceStore'
import { CheckIcon, LogOutIcon } from '@/ui/icons'
import styles from './AppearancePanel.module.css'

const MODES: Mode[] = ['dark', 'light']
const LANGUAGES: Array<{ id: Language; code: string }> = [
  { id: 'en', code: 'EN' },
  { id: 'uk', code: 'UA' }
]

/** Screen 7: mode, accent and language. Every choice applies the moment it is clicked. */
export function AppearancePanel({ onLogout }: { onLogout?: () => void }) {
  const { t } = useTranslation()
  const { mode, accent, language, setMode, setAccent, setLanguage } = useAppearance()

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>{t('settings.appearance')}</h2>

      <div className={styles.modes} role="radiogroup" aria-label={t('settings.appearance')}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={styles.mode}
            data-selected={mode === m}
            onClick={() => setMode(m)}
          >
            {/* The thumbnail renders in its own mode, whatever the app is in. */}
            <span className={styles.thumb} data-mode={m} style={{ '--accent': `var(--accent-${accent})` } as CSSProperties}>
              <span className={styles.thumbRail} />
              <span className={styles.thumbBlock} />
              <span className={styles.thumbBlock} />
              <span className={`${styles.thumbBlock} ${styles.thumbAccent}`} />
              <span className={styles.thumbBlock} />
            </span>
            <span className={styles.modeLabel}>{t(`settings.mode.${m}`)}</span>
          </button>
        ))}
      </div>

      <h3 className={styles.subheading}>{t('settings.color')}</h3>
      <div className={styles.accents} role="radiogroup" aria-label={t('settings.color')}>
        {ACCENTS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={accent === a}
            className={styles.accent}
            data-selected={accent === a}
            onClick={() => setAccent(a)}
          >
            <span className={styles.swatch} style={{ background: `var(--accent-${a})` }}>
              {accent === a && <CheckIcon size={14} />}
            </span>
            <span className={styles.accentLabel}>{t(`settings.accents.${a}`)}</span>
          </button>
        ))}
      </div>

      <h3 className={styles.subheading}>{t('settings.language')}</h3>
      <div className={styles.segmented} role="radiogroup" aria-label={t('settings.language')}>
        {LANGUAGES.map(({ id, code }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={language === id}
            className={styles.segment}
            data-selected={language === id}
            onClick={() => setLanguage(id)}
          >
            <span className={styles.code}>{code}</span>
            {t(`settings.languages.${id}`)}
          </button>
        ))}
      </div>

      {onLogout && (
        <button type="button" className={styles.logout} onClick={onLogout}>
          <LogOutIcon size={18} />
          {t('auth.logout')}
        </button>
      )}
    </div>
  )
}
