import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './Menu.module.css'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onSelect(): void
}

interface MenuProps {
  /** Where it opens: the pointer for a right-click, the button's corner for "⋯". */
  at: { x: number; y: number } | null
  items: MenuItem[]
  label: string
  /** selected: an item was picked (its action decides where focus goes next). */
  onClose(selected?: boolean): void
}

const MARGIN = 8

/**
 * A context menu: arrow keys move between items, Enter or Space picks one, Escape or a click
 * outside closes it. It flips to stay inside the window.
 */
export function Menu({ at, items, label, onClose }: MenuProps) {
  const list = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    if (!at || !list.current) return
    const { offsetWidth: w, offsetHeight: h } = list.current
    const left = at.x + w + MARGIN > window.innerWidth ? Math.max(MARGIN, at.x - w) : at.x
    const top = at.y + h + MARGIN > window.innerHeight ? Math.max(MARGIN, at.y - h) : at.y
    setPosition({ left, top })
    list.current.querySelector<HTMLElement>('[role=menuitem]:not([disabled])')?.focus()
  }, [at])

  useEffect(() => {
    if (!at) return
    const onPointer = (e: PointerEvent): void => {
      if (!list.current?.contains(e.target as Node)) onClose()
    }
    const onBlur = (): void => onClose()
    document.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onBlur)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onBlur)
    }
  }, [at, onClose])

  if (!at) return null

  const move = (delta: number): void => {
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])') ?? [])]
    const index = nodes.indexOf(document.activeElement as HTMLElement)
    nodes[(index + delta + nodes.length) % nodes.length]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') move(1)
    else if (e.key === 'ArrowUp') move(-1)
    else if (e.key === 'Escape' || e.key === 'Tab') onClose()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return createPortal(
    <div
      ref={list}
      role="menu"
      aria-label={label}
      className={styles.menu}
      style={position ?? { left: at.x, top: at.y, visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={`${styles.item} ${item.danger ? styles.danger : ''}`}
          onClick={() => {
            onClose(true)
            item.onSelect()
          }}
        >
          {item.icon && <span className={styles.icon}>{item.icon}</span>}
          <span className={styles.label}>{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  )
}
