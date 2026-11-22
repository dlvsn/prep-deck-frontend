import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WindowControls } from '../../shared/bridge'
import { CloseIcon, LogoIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from './icons'
import styles from './TitleBar.module.css'

/**
 * Our own title bar for the frameless window: a drag zone with the window buttons at the right,
 * Windows-style. Double-clicking the drag zone maximizes, as the OS does for its own frame.
 */
export function TitleBar({ controls }: { controls: WindowControls }) {
  const { t } = useTranslation()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void controls.isMaximized().then(setMaximized)
    return controls.onMaximizedChange(setMaximized)
  }, [controls])

  return (
    <header className={styles.bar}>
      <div className={styles.title}>
        <LogoIcon size={14} className={styles.logo} />
        <span>{t('app.name')}</span>
      </div>
      <div className={styles.buttons}>
        <button type="button" className={styles.button} onClick={controls.minimize} aria-label={t('window.minimize')} title={t('window.minimize')}>
          <MinimizeIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={controls.toggleMaximize}
          aria-label={t(maximized ? 'window.restore' : 'window.maximize')}
          title={t(maximized ? 'window.restore' : 'window.maximize')}
        >
          {maximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>
        <button type="button" className={`${styles.button} ${styles.close}`} onClick={controls.close} aria-label={t('window.close')} title={t('window.close')}>
          <CloseIcon size={16} />
        </button>
      </div>
    </header>
  )
}
