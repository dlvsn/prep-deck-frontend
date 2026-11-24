import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useDialogLayer } from '@/ui/dialogLayer'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/ui/icons'
import styles from './Lightbox.module.css'

const MIN_SCALE = 1
const MAX_SCALE = 6

interface View {
  scale: number
  x: number
  y: number
}

const FIT: View = { scale: 1, x: 0, y: 0 }

/**
 * A picture over the whole window. Arrows (on screen and ← / →) step through the card's pictures,
 * Escape closes; the wheel or a pinch zooms towards the pointer, dragging pans a zoomed picture,
 * a double click toggles 2×.
 */
export function Lightbox({ urls, index, onIndex, onClose }: { urls: string[]; index: number; onIndex(index: number): void; onClose(): void }) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const isTop = useDialogLayer(true, root, onClose)
  const [view, setView] = useState<View>(FIT)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; scale: number } | null>(null)
  const drag = useRef<{ x: number; y: number; view: View } | null>(null)

  useEffect(() => setView(FIT), [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!isTop() || urls.length < 2) return
      if (e.key === 'ArrowLeft') onIndex((index - 1 + urls.length) % urls.length)
      else if (e.key === 'ArrowRight') onIndex((index + 1) % urls.length)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, urls.length, onIndex, isTop])

  /** Zooms keeping the point under (cx, cy), in coordinates from the centre of the window. */
  const zoomAt = (next: number, cx: number, cy: number): void => {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
      if (scale === MIN_SCALE) return FIT
      const ratio = scale / v.scale
      return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio }
    })
  }

  const fromCentre = (clientX: number, clientY: number): [number, number] => {
    const rect = root.current!.getBoundingClientRect()
    return [clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2]
  }

  useEffect(() => {
    const node = root.current
    if (!node) return
    // Not a React handler: wheel must be non-passive to stop the page from scrolling.
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const [cx, cy] = fromCentre(e.clientX, e.clientY)
      // A touchpad pinch arrives as a wheel with Ctrl held, in finer steps.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025))
      setView((v) => {
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
        if (scale === MIN_SCALE) return FIT
        const ratio = scale / v.scale
        return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio }
      })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLImageElement>): void => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale }
      drag.current = null
    } else if (view.scale > 1) {
      drag.current = { x: e.clientX, y: e.clientY, view }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLImageElement>): void => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const [cx, cy] = fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2)
      zoomAt((pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.distance, cx, cy)
    } else if (drag.current) {
      const start = drag.current
      setView({ ...start.view, x: start.view.x + e.clientX - start.x, y: start.view.y + e.clientY - start.y })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLImageElement>): void => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const onDoubleClick = (e: ReactMouseEvent): void => {
    const [cx, cy] = fromCentre(e.clientX, e.clientY)
    if (view.scale > 1) setView(FIT)
    else zoomAt(2, cx, cy)
  }

  const step = (delta: number): void => onIndex((index + delta + urls.length) % urls.length)

  return createPortal(
    <div ref={root} className={styles.lightbox} role="dialog" aria-modal="true" aria-label={t('images.viewer')}>
      <div className={styles.backdrop} onClick={onClose} />
      <img
        key={urls[index]}
        className={styles.image}
        src={urls[index]}
        alt=""
        draggable={false}
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          cursor: view.scale > 1 ? 'grab' : 'zoom-in'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
      <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')} data-autofocus>
        <CloseIcon size={20} />
      </button>
      {urls.length > 1 && (
        <>
          <button type="button" className={`${styles.arrow} ${styles.left}`} onClick={() => step(-1)} aria-label={t('images.previous')}>
            <ChevronLeftIcon size={22} />
          </button>
          <button type="button" className={`${styles.arrow} ${styles.right}`} onClick={() => step(1)} aria-label={t('images.next')}>
            <ChevronRightIcon size={22} />
          </button>
          <span className={styles.counter}>{t('images.counter', { index: index + 1, total: urls.length })}</span>
        </>
      )}
    </div>,
    document.body
  )
}
