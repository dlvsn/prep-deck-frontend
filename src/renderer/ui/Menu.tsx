import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon } from './icons'
import styles from './Menu.module.css'

export interface MenuItem {
  id: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  /** Set for a choice among several (a role): shown with a tick when true. */
  checked?: boolean
  /** A second, quieter line under the label. */
  description?: string
  /** A small mark beside the label ("Coming soon"). */
  badge?: string
  /** A thin line above this item, to set it apart from the ones before. */
  separatorBefore?: boolean
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
const ITEMS = '[role^=menuitem]:not([disabled])'

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
    list.current.querySelector<HTMLElement>(ITEMS)?.focus()
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
    const nodes = [...(list.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])]
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
        <Fragment key={item.id}>
          {item.separatorBefore && <div className={styles.separator} role="separator" />}
          <button
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
            aria-checked={item.checked}
            disabled={item.disabled}
            title={item.disabled ? item.badge : undefined}
            className={`${styles.item} ${item.danger ? styles.danger : ''} ${item.description ? styles.withDescription : ''}`}
            onClick={() => {
              onClose(true)
              item.onSelect()
            }}
          >
            {item.checked !== undefined && (
              <span className={styles.check} aria-hidden="true">
                {item.checked && <CheckIcon size={14} />}
              </span>
            )}
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span className={styles.text}>
              <span className={styles.label}>
                {item.label}
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
              </span>
              {item.description && <span className={styles.description}>{item.description}</span>}
            </span>
          </button>
        </Fragment>
      ))}
    </div>,
    document.body
  )
}
