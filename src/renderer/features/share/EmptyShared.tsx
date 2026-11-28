import { useTranslation } from 'react-i18next'
import { SharedIcon } from '@/ui/icons'
import { AcceptLink } from './AcceptLink'
import styles from './EmptyShared.module.css'

/** Shared with me before anyone shared anything (mockup 22), with a place to paste a link. */
export function EmptyShared() {
  const { t } = useTranslation()
  return (
    <div className={styles.wrap}>
      <div className={styles.body}>
        <span className={styles.art} aria-hidden="true">
          <SharedIcon size={34} />
        </span>
        <h2 className={styles.title}>{t('shared.emptyTitle')}</h2>
        <p className={styles.text}>{t('shared.emptyBody')}</p>
        <AcceptLink />
      </div>
    </div>
  )
}
