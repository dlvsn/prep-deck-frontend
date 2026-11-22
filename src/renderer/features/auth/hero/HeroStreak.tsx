import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './HeroStreak.module.css'
import shared from './hero.module.css'

const WEEKS = 20
const DAYS = 7

/**
 * Twenty weeks of made-up activity, the same every time: a fixed-seed generator, so the picture
 * does not reshuffle between renders. The last month is never empty, matching the streak.
 */
const CELLS: ReadonlyArray<{ level: 0 | 1 | 2 | 3; week: number }> = (() => {
  const cells: Array<{ level: 0 | 1 | 2 | 3; week: number }> = []
  let seed = 7
  for (let i = 0; i < WEEKS * DAYS; i++) {
    seed = (seed * 9301 + 49297) % 233280
    const r = seed / 233280
    let level: 0 | 1 | 2 | 3 = r < 0.22 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3
    if (i > 110 && level === 0) level = 2
    cells.push({ level, week: Math.floor(i / DAYS) })
  }
  return cells
})()

/** Picture C: the streak ring fills, then the activity map appears week by week. Plays once. */
export function HeroStreak() {
  const { t } = useTranslation()
  return (
    <div className={shared.stage} aria-hidden="true">
      <div className={styles.column}>
        <div className={styles.head}>
          <span className={styles.ring}>
            <svg width="84" height="84" viewBox="0 0 84 84">
              <circle className={styles.track} cx="42" cy="42" r="36" />
              <circle className={styles.progress} cx="42" cy="42" r="36" />
            </svg>
            <span className={styles.days}>21</span>
          </span>
          <span className={styles.texts}>
            <span className={styles.title}>{t('auth.hero.streak')}</span>
            <span className={styles.sub}>{t('auth.hero.streakSub')}</span>
          </span>
        </div>

        <div className={styles.map}>
          {CELLS.map((cell, i) => (
            <span
              key={i}
              className={styles.cell}
              data-level={cell.level}
              style={{ '--week': cell.week } as CSSProperties}
            />
          ))}
        </div>

        <span className={styles.legend}>
          {t('auth.hero.less')}
          {([0, 1, 2, 3] as const).map((level) => (
            <span key={level} className={styles.legendCell} data-level={level} />
          ))}
          {t('auth.hero.more')}
        </span>
      </div>
    </div>
  )
}
