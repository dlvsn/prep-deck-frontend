import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCENTS } from '@/theme/accents'
import { useAppearance } from '@/theme/appearanceStore'
import { LogoIcon } from '@/ui/icons'
import styles from './HeroMesh.module.css'

/**
 * Picture F, the backdrop: three blurred blobs drifting slowly over the whole brand panel. The
 * accent leads; the other two are the accents two and five places further along, so every accent
 * gets its own mix and it follows the mode.
 */
export function MeshBlobs() {
  const accent = useAppearance((s) => s.accent)
  const at = ACCENTS.indexOf(accent)
  const hues = {
    '--hue-2': `var(--accent-${ACCENTS[(at + 2) % ACCENTS.length]})`,
    '--hue-3': `var(--accent-${ACCENTS[(at + 5) % ACCENTS.length]})`
  } as CSSProperties
  return (
    <div className={styles.blobs} style={hues} aria-hidden="true">
      <span className={`${styles.blob} ${styles.one}`} />
      <span className={`${styles.blob} ${styles.two}`} />
      <span className={`${styles.blob} ${styles.three}`} />
    </div>
  )
}

/** Picture F, the stage: the logo, large, and the name under it. */
export function HeroMesh() {
  const { t } = useTranslation()
  return (
    <div className={styles.stage} aria-hidden="true">
      <span className={styles.mark}>
        <LogoIcon size={46} />
      </span>
      <span className={styles.name}>{t('app.name')}</span>
    </div>
  )
}
