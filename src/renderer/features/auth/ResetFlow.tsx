import { useEffect, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api, USE_MOCKS } from '@/api'
import { DEMO_RESET_CODE } from '@/api/mocks/auth'
import { Button } from '@/ui/Button'
import { ArrowLeftIcon } from '@/ui/icons'
import { errorText, toastError, useToasts } from '@/ui/toast'
import { CodeInput, Field, PasswordField, StepDots, StrengthMeter } from './fields'
import styles from './forms.module.css'
import { isEmail, maskEmail, meetsPasswordRules, passwordStrength } from './password'

const RESEND_AFTER_S = 60

type Step = { n: 1 } | { n: 2; email: string } | { n: 3; email: string; token: string }

/**
 * Screens 15, 17, 18: email → the 6-digit code from the email → a new password. Back to log in
 * from any step; done, it returns there with the email filled in.
 */
export function ResetFlow({ initialEmail, onDone }: { initialEmail: string; onDone(email: string | null): void }) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>({ n: 1 })

  return (
    <div className={styles.flow}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => onDone(null)}>
          <ArrowLeftIcon size={18} />
          {t('auth.backToLogin')}
        </button>
        <StepDots step={step.n} />
      </div>
      {step.n === 1 && (
        <EmailStep initialEmail={isEmail(initialEmail) ? initialEmail : ''} onSent={(email) => setStep({ n: 2, email })} />
      )}
      {step.n === 2 && <CodeStep email={step.email} onVerified={(token) => setStep({ n: 3, email: step.email, token })} />}
      {step.n === 3 && <PasswordStep token={step.token} onSaved={() => onDone(step.email)} />}
    </div>
  )
}

function EmailStep({ initialEmail, onSent }: { initialEmail: string; onSent(email: string): void }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isEmail(email)) {
      setError(t(email.trim() ? 'auth.emailInvalid' : 'auth.emailRequired'))
      return
    }
    setBusy(true)
    try {
      await api.auth.requestPasswordReset(email.trim())
      onSent(email.trim())
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.resetTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.resetSub')}</p>
      </div>
      <Field
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        autoFocus
        value={email}
        error={error}
        onChange={(e) => {
          setEmail(e.target.value)
          setError(null)
        }}
      />
      <Button type="submit" variant="primary" className={styles.submit} disabled={busy}>
        {t('auth.sendCode')}
      </Button>
    </form>
  )
}

function CodeStep({ email, onVerified }: { email: string; onVerified(token: string): void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(RESEND_AFTER_S)

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const submit = async (e?: FormEvent): Promise<void> => {
    e?.preventDefault()
    if (code.length < 6) {
      setError(t('auth.codeIncomplete'))
      return
    }
    setBusy(true)
    try {
      onVerified(await api.auth.verifyResetCode(email, code))
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const resend = async (): Promise<void> => {
    try {
      await api.auth.requestPasswordReset(email)
      setLeft(RESEND_AFTER_S)
      useToasts.getState().show(t('auth.codeResent'))
    } catch (err) {
      toastError(err)
    }
  }

  const minutes = Math.floor(left / 60)
  const seconds = String(left % 60).padStart(2, '0')

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.checkEmail')}</h1>
        <p className={styles.subtitle}>{t('auth.codeSent', { email: maskEmail(email) })}</p>
      </div>
      <div>
        <CodeInput
          value={code}
          label={t('auth.code')}
          invalid={Boolean(error)}
          onChange={(value) => {
            setCode(value)
            setError(null)
          }}
        />
      </div>
      {error ? (
        <p className={`${styles.note} ${styles.noteError}`} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.note}>{t('auth.codeValid')}</p>
      )}
      <Button type="submit" variant="primary" className={styles.submit} disabled={busy}>
        {t('auth.continue')}
      </Button>
      <p className={styles.footer}>
        {t('auth.noCode')}{' '}
        {left > 0 ? (
          <span className={styles.timer}>{t('auth.resendIn', { time: `${minutes}:${seconds}` })}</span>
        ) : (
          <button type="button" className={styles.link} onClick={resend}>
            {t('auth.resend')}
          </button>
        )}
      </p>
      {USE_MOCKS && (
        <p className={styles.demo}>
          <Trans i18nKey="auth.demoCode" values={{ code: DEMO_RESET_CODE }} components={{ code: <code /> }} />
        </p>
      )}
    </form>
  )
}

function PasswordStep({ token, onSaved }: { token: string; onSaved(): void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const rulesError = touched && password && !meetsPasswordRules(password) ? t('auth.passwordRules') : null
  const confirmError = confirm && confirm !== password ? t('auth.passwordsDiffer') : null

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    setTouched(true)
    if (!meetsPasswordRules(password)) return
    if (confirm !== password) {
      if (!confirm) setServerError(t('auth.confirmRequired'))
      return
    }
    setBusy(true)
    try {
      await api.auth.resetPassword(token, password)
      useToasts.getState().show(t('auth.passwordChanged'))
      onSaved()
    } catch (err) {
      setServerError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.newPasswordTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.newPasswordSub')}</p>
      </div>
      <PasswordField
        label={t('auth.newPassword')}
        autoComplete="new-password"
        autoFocus
        value={password}
        error={rulesError}
        onChange={(e) => setPassword(e.target.value)}
        onBlur={() => setTouched(true)}
        below={
          <>
            <StrengthMeter strength={passwordStrength(password)} />
            {!rulesError && <p className={styles.note}>{t('auth.passwordHint')}</p>}
          </>
        }
      />
      <PasswordField
        label={t('auth.repeatPassword')}
        autoComplete="new-password"
        value={confirm}
        error={confirmError ?? serverError}
        success={confirm && confirm === password ? t('auth.passwordsMatch') : null}
        onChange={(e) => {
          setConfirm(e.target.value)
          setServerError(null)
        }}
      />
      <Button type="submit" variant="primary" className={styles.submit} disabled={busy}>
        {t('auth.savePassword')}
      </Button>
    </form>
  )
}
