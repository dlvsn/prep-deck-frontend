import { useTranslation } from 'react-i18next'
import styles from './AuthArt.module.css'

/**
 * Placeholder art for the brand panel: three cards floating at an angle, built from the theme's
 * own tokens so it follows mode and accent. Meant to be swapped for something else later.
 */
export function AuthArt() {
  const { t } = useTranslation()
  return (
    <div className={styles.art} aria-hidden="true">
      <div className={`${styles.card} ${styles.back}`}>
        <span className={`${styles.chip} ${styles.learning}`}>{t('filters.learning')}</span>
        <p className={styles.question}>How is the JVM heap organized?</p>
      </div>
      <div className={`${styles.card} ${styles.middle}`}>
        <span className={`${styles.chip} ${styles.known}`}>{t('filters.known')}</span>
        <p className={styles.question}>@Component vs @Bean</p>
      </div>
      <div className={`${styles.card} ${styles.front}`}>
        <p className={styles.question}>Present Perfect vs Past Simple</p>
        <div className={styles.grades}>
          <span />
          <span className={styles.hard} />
          <span className={styles.good} />
          <span />
        </div>
      </div>
    </div>
  )
}
