import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import styles from './Popover.module.css'

type Placement = 'right-end' | 'sheet'

interface PopoverProps {
  open: boolean
  onClose(): void
  anchor: RefObject<HTMLElement | null>
  /** right-end: beside the anchor, bottoms aligned (from the rail). sheet: along the bottom edge. */
  placement: Placement
  label: string
  children: ReactNode
}

const GAP = 12
const MARGIN = 8

/**
 * A floating panel tied to the button that opened it. Closes on Escape, on a click outside, and
 * hands focus back to that button. It grows out of the button (transform-origin follows it).
 */
export function Popover({ open, onClose, anchor, placement, label, children }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  useLayoutEffect(() => {
    if (!open || placement !== 'right-end') return
    const place = (): void => {
      const a = anchor.current?.getBoundingClientRect()
      const p = panel.current
      if (!a || !p) return
      const height = p.offsetHeight
      const top = Math.max(MARGIN, Math.min(a.bottom - height, window.innerHeight - height - MARGIN))
      const left = Math.min(a.right + GAP, window.innerWidth - p.offsetWidth - MARGIN)
      setStyle({ top, left, transformOrigin: `left ${a.top + a.height / 2 - top}px` })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, placement, anchor])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    const opener = anchor.current
    panel.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      opener?.focus()
    }
  }, [open, onClose, anchor])

  if (!open) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      tabIndex={-1}
      className={`${styles.panel} ${placement === 'sheet' ? styles.sheet : styles.floating}`}
      style={placement === 'sheet' ? undefined : style}
    >
      {children}
    </div>,
    document.body
  )
}
