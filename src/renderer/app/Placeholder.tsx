import { useTranslation } from 'react-i18next'
import styles from './Placeholder.module.css'

/** The empty content area of stage 1; each section replaces it with its real screen. */
export function Placeholder({ titleKey }: { titleKey: 'nav.shared' | 'nav.practice' }) {
  const { t } = useTranslation()
  return (
    <section className={styles.area}>
      <h1 className={styles.title}>{t(titleKey)}</h1>
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('topics.emptyTitle')}</p>
        <p className={styles.emptyBody}>{t('topics.emptyBody')}</p>
      </div>
    </section>
  )
}
