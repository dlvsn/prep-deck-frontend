import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api'
import { ApiError } from '@/api/http'
import type { Registration } from '@/api/types'
import { useSession } from '@/app/session'
import { Button } from '@/ui/Button'
import { errorText } from '@/ui/toast'
import { Field, PasswordField, StrengthMeter } from './fields'
import styles from './forms.module.css'
import { isEmail, meetsPasswordRules, passwordStrength } from './password'

type Availability = 'unknown' | 'checking' | 'free' | 'taken'
type Errors = Partial<Record<'email' | 'username' | 'password' | 'confirm', string>>

/**
 * Screen 14: email, username, password with its strength, and the password again. Problems show
 * under their field: a format once the field is left, a taken username and a mismatch as typed.
 */
export interface RegisterValues {
  email: string
  username: string
}

export function RegisterForm({
  initial,
  onLogin,
  onRegistered
}: {
  /** What was typed before going on to the code screen and coming back ("Change it"). */
  initial?: RegisterValues
  onLogin(): void
  /** The account waits for its code: the code screen comes next. */
  onRegistered(registration: Registration, values: RegisterValues): void
}) {
  const { t } = useTranslation()
  const register = useSession((s) => s.register)
  const [values, setValues] = useState({
    email: initial?.email ?? '',
    username: initial?.username ?? '',
    password: '',
    confirm: ''
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [serverErrors, setServerErrors] = useState<Errors>({})
  const [availability, setAvailability] = useState<Availability>('unknown')
  const [busy, setBusy] = useState(false)

  const username = values.username.trim()
  useEffect(() => {
    if (username.length < 3) {
      setAvailability('unknown')
      return
    }
    setAvailability('checking')
    let cancelled = false
    const timer = setTimeout(() => {
      api.auth
        .isUsernameFree(username)
        .then((free) => !cancelled && setAvailability(free ? 'free' : 'taken'))
        .catch(() => !cancelled && setAvailability('unknown'))
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username])

  const strength = passwordStrength(values.password)
  const emailOk = isEmail(values.email)

  const errors: Errors = {
    email:
      serverErrors.email ??
      (touched.email && !values.email.trim()
        ? t('auth.emailRequired')
        : touched.email && !emailOk
          ? t('auth.emailInvalid')
          : undefined),
    username:
      serverErrors.username ??
      (availability === 'taken'
        ? t('auth.usernameTaken')
        : touched.username && username.length < 3
          ? t('auth.usernameShort')
          : undefined),
    password:
      serverErrors.password ??
      (touched.password && values.password && !meetsPasswordRules(values.password) ? t('auth.passwordRules') : undefined),
    confirm: values.confirm && values.confirm !== values.password ? t('auth.passwordsDiffer') : undefined
  }

  const set = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues({ ...values, [field]: e.target.value })
    if (serverErrors[field as keyof Errors]) setServerErrors({ ...serverErrors, [field]: undefined })
  }
  const blur = (field: string) => () => setTouched((t) => ({ ...t, [field]: true }))

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setTouched({ email: true, username: true, password: true, confirm: true })
    const valid =
      emailOk &&
      username.length >= 3 &&
      availability !== 'taken' &&
      meetsPasswordRules(values.password) &&
      values.confirm === values.password
    if (!valid) {
      if (!values.confirm) setServerErrors((s) => ({ ...s, confirm: t('auth.confirmRequired') }))
      return
    }
    setBusy(true)
    try {
      const registration = await register(values.email, username, values.password)
      onRegistered(registration, { email: values.email, username: values.username })
    } catch (error) {
      // The server's key says which field it is about: auth.emailTaken, auth.usernameInvalid…
      const code = error instanceof ApiError ? error.message : ''
      if (code.startsWith('auth.email')) setServerErrors({ email: errorText(error) })
      else if (code.startsWith('auth.username')) setServerErrors({ username: errorText(error) })
      else if (code.startsWith('auth.password')) setServerErrors({ password: errorText(error) })
      else setServerErrors({ confirm: errorText(error) })
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.createAccount')}</h1>
        <p className={styles.subtitle}>{t('auth.createAccountSub')}</p>
      </div>

      <Field
        label={t('auth.email')}
        type="email"
        placeholder="name@example.com"
        autoComplete="email"
        autoFocus
        value={values.email}
        valid={emailOk}
        error={errors.email}
        onChange={set('email')}
        onBlur={blur('email')}
      />

      <Field
        label={t('auth.username')}
        autoComplete="username"
        value={values.username}
        valid={availability === 'free'}
        error={errors.username}
        success={availability === 'free' ? t('auth.usernameFree') : null}
        onChange={set('username')}
        onBlur={blur('username')}
      />

      <PasswordField
        label={t('auth.password')}
        autoComplete="new-password"
        value={values.password}
        error={errors.password}
        onChange={set('password')}
        onBlur={blur('password')}
        below={
          <>
            <StrengthMeter strength={strength} />
            {!errors.password && <p className={styles.note}>{t('auth.passwordHint')}</p>}
          </>
        }
      />

      <PasswordField
        label={t('auth.repeatPassword')}
        autoComplete="new-password"
        value={values.confirm}
        error={errors.confirm ?? serverErrors.confirm}
        success={values.confirm && values.confirm === values.password ? t('auth.passwordsMatch') : null}
        onChange={set('confirm')}
      />

      <Button type="submit" variant="primary" className={styles.submit} disabled={busy}>
        {busy ? t('auth.creating') : t('auth.createAccount')}
      </Button>

      <p className={styles.footer}>
        {t('auth.haveAccount')}{' '}
        <button type="button" className={styles.link} onClick={onLogin}>
          {t('auth.loginLink')}
        </button>
      </p>
    </form>
  )
}
