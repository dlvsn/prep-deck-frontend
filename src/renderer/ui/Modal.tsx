import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDialogLayer } from './dialogLayer'
import { CloseIcon } from './icons'
import styles from './Modal.module.css'

interface ModalProps {
  open: boolean
  onClose(): void
  title: ReactNode
  subtitle?: ReactNode
  /** Width in px on a wide window; the dialog never grows past the window. */
  width?: number
  children: ReactNode
  footer?: ReactNode
}

/**
 * A dialog over a scrim. Escape and the scrim close it, Tab stays inside it, and focus returns
 * to whatever was focused before it opened. Over another dialog it takes the keys first.
 */
export function Modal({ open, onClose, title, subtitle, width = 500, children, footer }: ModalProps) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDivElement>(null)
  useDialogLayer(open, dialog, onClose)

  if (!open) return null
  return createPortal(
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} role="dialog" aria-modal="true" className={styles.dialog} style={{ width }}>
        <header className={styles.header}>
          <div className={styles.titles}>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
            <CloseIcon size={18} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}
