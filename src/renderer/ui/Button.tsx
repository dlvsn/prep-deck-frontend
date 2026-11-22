import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  /** Icon only, square; the text goes to aria-label instead. */
  iconOnly?: boolean
  /** Waiting on the server: a spinner before the text, and the button does not take clicks. */
  busy?: boolean
}

export function Button({
  variant = 'secondary',
  icon,
  iconOnly,
  busy,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], iconOnly ? styles.iconOnly : '', busy ? styles.busy : '', className ?? ''].join(' ')
  return (
    <button type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {!iconOnly && children}
    </button>
  )
}
