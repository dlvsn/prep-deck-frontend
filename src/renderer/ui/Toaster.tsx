import { createPortal } from 'react-dom'
import { useToasts } from './toast'
import styles from './Toaster.module.css'

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return createPortal(
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={styles.toast}>
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  )
}
