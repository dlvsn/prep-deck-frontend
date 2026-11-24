import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/http'
import type { UnconfirmedEmail } from '@/api/types'
import { useSession } from '@/app/session'
import { Button } from '@/ui/Button'
import { errorText } from '@/ui/toast'
import { Field, PasswordField } from './fields'
import styles from './forms.module.css'

/** Screen 13: email or username, password, "Forgot password?", and the way to sign up. */
export function LoginForm({
  initialLogin = '',
  onRegister,
  onForgot,
  onUnconfirmed
}: {
  initialLogin?: string
  onRegister(): void
  onForgot(login: string): void
  /** The right password, an email not yet confirmed: a code was sent, the code screen comes next. */
  onUnconfirmed(unconfirmed: UnconfirmedEmail): void
}) {
  const { t } = useTranslation()
  const login = useSession((s) => s.login)
  const [values, setValues] = useState({ login: initialLogin, password: '' })
  const [errors, setErrors] = useState<{ login?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    const next = {
      login: values.login.trim() ? undefined : t('auth.loginRequired'),
      password: values.password ? undefined : t('auth.passwordRequired')
    }
    setErrors(next)
    if (next.login || next.password) return
    setBusy(true)
    try {
      await login(values.login, values.password)
    } catch (error) {
      if (error instanceof ApiError && error.message === 'auth.emailNotVerified' && error.data) {
        onUnconfirmed(error.data as UnconfirmedEmail)
        return
      }
      setErrors({ password: errorText(error) })
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.welcome')}</h1>
        <p className={styles.subtitle}>{t('auth.welcomeSub')}</p>
      </div>

      <Field
        label={t('auth.emailOrUsername')}
        placeholder="name@example.com"
        autoComplete="username"
        autoFocus={!initialLogin}
        value={values.login}
        error={errors.login}
        onChange={(e) => setValues({ ...values, login: e.target.value })}
      />

      <PasswordField
        label={t('auth.password')}
        labelAside={
          <button type="button" className={`${styles.link} ${styles.small}`} onClick={() => onForgot(values.login)}>
            {t('auth.forgot')}
          </button>
        }
        autoComplete="current-password"
        autoFocus={Boolean(initialLogin)}
        value={values.password}
        error={errors.password}
        onChange={(e) => setValues({ ...values, password: e.target.value })}
      />

      <Button type="submit" variant="primary" className={styles.submit} busy={busy}>
        {busy ? t('auth.loggingIn') : t('auth.login')}
      </Button>

      <p className={styles.footer}>
        {t('auth.noAccount')}{' '}
        <button type="button" className={styles.link} onClick={onRegister}>
          {t('auth.createOne')}
        </button>
      </p>

    </form>
  )
}
