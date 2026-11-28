import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/ui/Button'
import { PracticeIcon } from '@/ui/icons'
import styles from './PracticeSoon.module.css'

const POINTS = ['due', 'grade', 'streak'] as const

/** The Practice section until practice (stage 5) is built: what is coming, and a way back. */
export function PracticeSoon() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <section className={styles.area}>
      <h1 className={styles.heading}>{t('nav.practice')}</h1>
      <div className={styles.body}>
        <span className={styles.art} aria-hidden="true">
          <PracticeIcon size={34} />
        </span>
        <span className={styles.badge}>{t('practice.soon.badge')}</span>
        <h2 className={styles.title}>{t('practice.soon.title')}</h2>
        <p className={styles.text}>{t('practice.soon.text')}</p>
        <ul className={styles.points}>
          {POINTS.map((point, i) => (
            <li key={point} className={styles.point} style={{ animationDelay: `${120 + i * 60}ms` }}>
              {t(`practice.soon.points.${point}`)}
            </li>
          ))}
        </ul>
        <Button onClick={() => navigate('/topics')}>{t('practice.soon.back')}</Button>
      </div>
    </section>
  )
}
