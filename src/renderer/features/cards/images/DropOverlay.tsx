import styles from './DropOverlay.module.css'

/**
 * Over a drop zone while files are dragged onto it: the scrim, a dashed accent frame and what a
 * drop would do. `muted` (view only, no free slot) drops the accent: the drop is refused.
 */
export function DropOverlay({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <div className={`${styles.overlay} ${muted ? styles.muted : ''}`} aria-live="polite">
      <div className={styles.frame}>
        <p className={styles.text}>{text}</p>
      </div>
    </div>
  )
}
