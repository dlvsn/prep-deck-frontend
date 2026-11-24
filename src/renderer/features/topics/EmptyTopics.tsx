import { useTranslation } from 'react-i18next'
import { Button } from '@/ui/Button'
import { PlusIcon } from '@/ui/icons'
import styles from './EmptyTopics.module.css'

const STEPS = ['create', 'cards', 'practice'] as const

/**
 * My topics before the first topic (mockup 21): what topics are, a New topic button and the three
 * steps of the app. It takes the whole content area; the tree panel beside it stays empty.
 */
export function EmptyTopics({ onCreate }: { onCreate(): void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.wrap}>
      <div className={styles.body}>
        <svg className={styles.art} width="200" height="140" viewBox="0 0 200 140" aria-hidden="true">
          <rect className={styles.back} x="58" y="14" width="104" height="72" rx="12" transform="rotate(-8 110 50)" />
          <rect className={styles.middle} x="48" y="26" width="104" height="72" rx="12" transform="rotate(4 100 62)" />
          <rect className={styles.front} x="40" y="40" width="112" height="78" rx="13" />
          <rect className={styles.line} x="56" y="58" width="56" height="8" rx="4" />
          <rect className={styles.line} x="56" y="74" width="80" height="6" rx="3" />
          <rect className={styles.line} x="56" y="86" width="64" height="6" rx="3" />
          <g className={styles.plus}>
            <circle cx="152" cy="112" r="20" />
            <path d="M152 103v18M143 112h18" />
          </g>
        </svg>

        <h2 className={styles.title}>{t('topics.first.title')}</h2>
        <p className={styles.text}>{t('topics.first.body')}</p>
        <Button variant="primary" icon={<PlusIcon size={16} />} onClick={onCreate}>
          {t('topics.new')}
        </Button>

        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step} className={styles.step} style={{ animationDelay: `${120 + i * 60}ms` }}>
              <span className={styles.number} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.stepTitle}>{t(`topics.first.steps.${step}.title`)}</span>
              <span className={styles.stepText}>{t(`topics.first.steps.${step}.text`)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
