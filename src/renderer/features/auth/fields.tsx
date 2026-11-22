import { useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, EyeIcon, EyeOffIcon } from '@/ui/icons'
import styles from './fields.module.css'
import type { Strength } from './password'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: ReactNode
  /** Something on the label's line, at the right: "Forgot password?". */
  labelAside?: ReactNode
  /** Red text under the field; also marks the input as invalid. */
  error?: string | null
  /** Accent text under the field: "Username is free". */
  success?: string | null
  /** A check mark inside the field when its value is good. */
  valid?: boolean
  /** Something inside the field at the right: the eye of a password field. */
  trailing?: ReactNode
  /** Below the field, above the error: the strength meter, the password rules. */
  below?: ReactNode
}

/** A labelled input with its message underneath, as the auth mockups draw it. */
export function Field({ label, labelAside, error, success, valid, trailing, below, className, ...input }: FieldProps) {
  const id = useId()
  const messageId = `${id}-message`
  return (
    <div className={`${styles.field} ${className ?? ''}`}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {labelAside}
      </div>
      <div className={`${styles.control} ${error ? styles.invalid : ''}`}>
        <input
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || success ? messageId : undefined}
          {...input}
        />
        {valid && !error && !trailing && (
          <span className={styles.check} aria-hidden="true">
            <CheckIcon size={18} />
          </span>
        )}
        {trailing}
      </div>
      {below}
      {error ? (
        <p id={messageId} className={styles.error} role="alert">
          {error}
        </p>
      ) : success ? (
        <p id={messageId} className={styles.success}>
          {success}
        </p>
      ) : null}
    </div>
  )
}

/** A password field with the eye that shows what was typed. */
export function PasswordField(props: Omit<FieldProps, 'type' | 'trailing'>) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.eye}
          onClick={() => setVisible((v) => !v)}
          aria-label={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
        </button>
      }
    />
  )
}

const STRENGTH_KEYS = ['auth.strength.weak', 'auth.strength.fair', 'auth.strength.good', 'auth.strength.strong'] as const

/** Four segments filling up with the password, and the word for how good it is. */
export function StrengthMeter({ strength }: { strength: Strength }) {
  const { t } = useTranslation()
  return (
    <div className={styles.strength} data-strength={strength} aria-live="polite">
      <div className={styles.segments} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= strength ? styles.segmentOn : styles.segment} />
        ))}
      </div>
      <span className={styles.strengthLabel}>{strength > 0 ? t(STRENGTH_KEYS[strength - 1]) : ''}</span>
    </div>
  )
}

/** Six boxes for the emailed code: typing moves on, Backspace goes back, a paste fills them all. */
export function CodeInput({
  value,
  onChange,
  invalid,
  label
}: {
  value: string
  onChange(value: string): void
  invalid?: boolean
  label: string
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  const setAt = (index: number, digit: string): void => {
    const next = digits.slice()
    next[index] = digit
    onChange(next.join('').slice(0, 6))
  }

  /** Several digits arriving in one box (fast typing, the OS filling the code in) spill over. */
  const fillFrom = (index: number, typed: string): void => {
    const next = digits.slice()
    for (let k = 0; k < typed.length && index + k < 6; k++) next[index + k] = typed[k]
    onChange(next.join('').slice(0, 6))
    boxes.current[Math.min(index + typed.length, 5)]?.focus()
  }

  return (
    <div className={styles.code} role="group" aria-label={label}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el
          }}
          className={`${styles.codeBox} ${invalid ? styles.invalid : ''}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={digit}
          autoFocus={i === 0}
          aria-label={`${label} ${i + 1}`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            // Only what was just inserted counts: the box may already hold a digit, and the caret
            // may sit before it or after it. The caret ends right after the inserted text.
            const raw = e.target.value
            const end = e.target.selectionStart ?? raw.length
            const inserted = raw.slice(Math.max(0, end - (raw.length - digit.length)), end)
            const typed = inserted.replace(/\D/g, '')
            if (typed) fillFrom(i, typed)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              if (digit) setAt(i, '')
              else if (i > 0) {
                setAt(i - 1, '')
                boxes.current[i - 1]?.focus()
              }
            } else if (e.key === 'ArrowLeft') boxes.current[i - 1]?.focus()
            else if (e.key === 'ArrowRight') boxes.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (!pasted) return
            e.preventDefault()
            onChange(pasted)
            boxes.current[Math.min(pasted.length, 5)]?.focus()
          }}
        />
      ))}
    </div>
  )
}

/** Where the reset flow is: three dots, the current one stretched. */
export function StepDots({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <div className={styles.dots} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i + 1 === step ? styles.dotActive : i + 1 < step ? styles.dotDone : styles.dot} />
      ))}
    </div>
  )
}
