import { useTranslation } from 'react-i18next'
import styles from './HeroCards.module.css'
import shared from './hero.module.css'
import { SAMPLE } from './samples'

/** Picture A: three cards at an angle, each floating up and down at its own pace. */
export function HeroCards() {
  const { t } = useTranslation()
  return (
    <div className={shared.stage} aria-hidden="true">
      <div className={styles.cards}>
        <div className={`${shared.card} ${styles.card} ${styles.back}`}>
          <span className={shared.chip} data-status="learning">
            {t('filters.learning')}
          </span>
          <p className={shared.question}>{SAMPLE.heap}</p>
        </div>
        <div className={`${shared.card} ${styles.card} ${styles.middle}`}>
          <span className={shared.chip} data-status="known">
            {t('filters.known')}
          </span>
          <p className={shared.question}>{SAMPLE.beans}</p>
        </div>
        <div className={`${shared.card} ${shared.accentCard} ${styles.card} ${styles.front}`}>
          <p className={shared.question}>{SAMPLE.tenses}</p>
          <div className={styles.grades}>
            <span />
            <span className={styles.hard} />
            <span className={styles.good} />
            <span />
          </div>
        </div>
      </div>
    </div>
  )
}
