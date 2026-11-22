import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '@/theme/appearanceStore'
import { LogoIcon, MoonIcon, SunIcon } from '@/ui/icons'
import { AuthArt } from './AuthArt'
import styles from './AuthScreen.module.css'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ResetFlow } from './ResetFlow'

type View = { kind: 'login'; login: string } | { kind: 'register' } | { kind: 'reset'; email: string }

/**
 * Log in, create an account, reset the password: one screen, as on mockups 13–18. The left half
 * is the brand panel (the picture there is a placeholder and may change); the form sits right.
 * A narrow window drops the panel and keeps the logo in a top bar.
 */
export function AuthScreen() {
  const { t } = useTranslation()
  const [view, setView] = useState<View>({ kind: 'login', login: '' })

  return (
    <div className={styles.screen}>
      <aside className={styles.brand}>
        <Logo />
        <AuthArt />
        <div className={styles.tagline}>
          <h2 className={styles.taglineTitle}>{t('auth.tagline')}</h2>
          <p className={styles.taglineBody}>{t('auth.taglineSub')}</p>
        </div>
      </aside>

      <main className={styles.side}>
        <div className={styles.topBar}>
          <div className={styles.topLogo}>
            <Logo />
          </div>
          <AuthControls />
        </div>

        <div className={styles.formArea}>
          <div className={styles.formBox}>
            {view.kind === 'login' && (
              <LoginForm
                key="login"
                initialLogin={view.login}
                onRegister={() => setView({ kind: 'register' })}
                onForgot={(login) => setView({ kind: 'reset', email: login })}
              />
            )}
            {view.kind === 'register' && <RegisterForm onLogin={() => setView({ kind: 'login', login: '' })} />}
            {view.kind === 'reset' && (
              <ResetFlow initialEmail={view.email} onDone={(email) => setView({ kind: 'login', login: email ?? '' })} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function Logo() {
  const { t } = useTranslation()
  return (
    <div className={styles.logo}>
      <span className={styles.logoMark} aria-hidden="true">
        <LogoIcon size={22} />
      </span>
      <span className={styles.logoName}>{t('app.name')}</span>
    </div>
  )
}

/** The small EN | UA switch and the light / dark button in the corner. */
function AuthControls() {
  const { t } = useTranslation()
  const { mode, language, setMode, setLanguage } = useAppearance()
  return (
    <div className={styles.controls}>
      <div className={styles.langs} role="radiogroup" aria-label={t('settings.language')}>
        {(['en', 'uk'] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            role="radio"
            aria-checked={language === lang}
            aria-label={t(`settings.languages.${lang}`)}
            className={styles.lang}
            data-selected={language === lang}
            onClick={() => setLanguage(lang)}
          >
            {lang === 'en' ? 'EN' : 'UA'}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.modeButton}
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        aria-label={t(mode === 'dark' ? 'auth.toLight' : 'auth.toDark')}
        title={t(mode === 'dark' ? 'auth.toLight' : 'auth.toDark')}
      >
        {mode === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
      </button>
    </div>
  )
}
