import { useTranslation } from 'react-i18next'
import styles from './HeroFlip.module.css'
import shared from './hero.module.css'
import { SAMPLE } from './samples'

const GRADES = ['again', 'hard', 'good', 'easy'] as const

/**
 * Picture B: a card turns over, question → answer, and "Good" bounces once the answer shows,
 * then it turns back. One 7-second loop drives both, so they stay in step.
 */
export function HeroFlip() {
  const { t } = useTranslation()
  return (
    <div className={shared.stage} aria-hidden="true">
      <div className={styles.column}>
        <div className={styles.scene}>
          <div className={styles.flipper}>
            <div className={`${shared.card} ${styles.face}`}>
              <span className={styles.meta}>
                {t('auth.hero.question')} · {SAMPLE.gcTag}
              </span>
              <p className={styles.question}>{SAMPLE.gcQuestion}</p>
              <span className={styles.showAnswer}>{t('practice.show')}</span>
            </div>
            <div className={`${shared.card} ${shared.accentCard} ${styles.face} ${styles.backFace}`}>
              <span className={styles.answerLabel}>{t('auth.hero.answer')}</span>
              <p className={styles.answer}>
                {SAMPLE.gcAnswerStart}
                <b>{SAMPLE.gcAnswerTerm}</b>
                {SAMPLE.gcAnswerEnd}
              </p>
              <span className={styles.lines}>
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
        <div className={styles.grades}>
          {GRADES.map((grade) => (
            <span key={grade} className={grade === 'good' ? `${styles.grade} ${styles.good}` : styles.grade}>
              {t(`practice.grades.${grade}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
