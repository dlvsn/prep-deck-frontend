import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  /** Icon only, square; the text goes to aria-label instead. */
  iconOnly?: boolean
}

export function Button({ variant = 'secondary', icon, iconOnly, className, children, type = 'button', ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], iconOnly ? styles.iconOnly : '', className ?? ''].join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon}
      {!iconOnly && children}
    </button>
  )
}
