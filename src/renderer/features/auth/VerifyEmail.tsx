import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api, USE_MOCKS } from '@/api'
import { ApiError } from '@/api/http'
import { DEMO_CODE } from '@/api/mocks/auth'
import type { CodeAttempts, RetryAfter, Session } from '@/api/types'
import { useSession } from '@/app/session'
import { Button } from '@/ui/Button'
import { ArrowLeftIcon, CheckIcon } from '@/ui/icons'
import { errorText, useToasts } from '@/ui/toast'
import { CodeInput, StepDots } from './fields'
import styles from './forms.module.css'
import { maskEmail } from './password'

/** The backend's resend cooldown; a refusal inside it says the exact seconds left. */
const RESEND_COOLDOWN_S = 60

/**
 * Screens 19 and 20: the second step of sign-up. The six digits from the letter confirm the
 * email; the sixth digit sends them at once. "Back" and "Change it" return to the sign-up form.
 */
export function VerifyEmail({
  email,
  resendAfterSeconds,
  onBack,
  onVerified
}: {
  email: string
  resendAfterSeconds: number
  onBack(): void
  onVerified(session: Session): void
}) {
  const { t } = useTranslation()
  const verifyEmail = useSession((s) => s.verifyEmail)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(resendAfterSeconds)
  const submitted = useRef('')

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft(left - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const submit = async (value: string): Promise<void> => {
    if (value.length < 6) {
      setError(t('auth.codeIncomplete'))
      return
    }
    if (busy) return
    submitted.current = value
    setBusy(true)
    try {
      onVerified(await verifyEmail(email, value))
    } catch (err) {
      const key = err instanceof ApiError ? err.message : ''
      if (key === 'auth.codeInvalid') {
        const attemptsLeft = (err as ApiError).data as CodeAttempts | null
        setError(t('auth.codeWrong', { count: attemptsLeft?.attemptsLeft ?? 0 }))
      } else {
        setError(errorText(err))
      }
      // A spent or expired code cannot be fixed by retyping: clear it for the next letter's.
      if (key === 'auth.codeAttemptsExhausted' || key === 'auth.codeExpired') setCode('')
      setBusy(false)
    }
  }

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault()
    void submit(code)
  }

  const resend = async (): Promise<void> => {
    try {
      await api.auth.resendVerification(email)
      setLeft(RESEND_COOLDOWN_S)
      setError(null)
      setCode('')
      useToasts.getState().show(t('auth.codeResent'))
    } catch (err) {
      const retry = err instanceof ApiError ? (err.data as RetryAfter | null) : null
      if (retry?.retryAfterSeconds) setLeft(retry.retryAfterSeconds)
      else setError(errorText(err))
    }
  }

  const minutes = Math.floor(left / 60)
  const seconds = String(left % 60).padStart(2, '0')

  return (
    <div className={styles.flow}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeftIcon size={18} />
          {t('auth.back')}
        </button>
        <StepDots step={2} total={2} />
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('auth.verifyTitle')}</h1>
          <p className={styles.subtitle}>{t('auth.verifySub', { email: maskEmail(email) })}</p>
        </div>

        <div className={styles.codeField}>
          <span className={styles.fieldLabel}>{t('auth.verificationCode')}</span>
          <CodeInput
            value={code}
            label={t('auth.verificationCode')}
            invalid={Boolean(error)}
            onChange={(value) => {
              setCode(value)
              setError(null)
              // The sixth digit sends the code; the same six digits twice do not.
              if (value.length === 6 && value !== submitted.current) void submit(value)
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
          {t('auth.confirm')}
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

        <p className={styles.footer}>
          {t('auth.wrongEmail')}{' '}
          <button type="button" className={styles.link} onClick={onBack}>
            {t('auth.change')}
          </button>
        </p>

        {USE_MOCKS && (
          <p className={styles.demo}>
            <Trans i18nKey="auth.demoCode" values={{ code: DEMO_CODE }} components={{ code: <code /> }} />
          </p>
        )}
      </form>
    </div>
  )
}

/** "Email confirmed": the account is ready; its button enters the app with the new session. */
export function EmailVerified({ session }: { session: Session }) {
  const { t } = useTranslation()
  const start = useSession((s) => s.start)
  const [busy, setBusy] = useState(false)
  return (
    <div className={styles.form}>
      <span className={styles.doneMark} aria-hidden="true">
        <CheckIcon size={28} />
      </span>
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('auth.verifiedTitle')}</h1>
        <p className={styles.subtitle}>{t('auth.verifiedSub')}</p>
      </div>
      <Button
        variant="primary"
        className={styles.submit}
        disabled={busy}
        autoFocus
        onClick={() => {
          setBusy(true)
          void start(session)
        }}
      >
        {t('auth.openApp')}
      </Button>
    </div>
  )
}
