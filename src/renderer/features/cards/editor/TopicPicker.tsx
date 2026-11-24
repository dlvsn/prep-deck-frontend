import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@/api/types'
import { pathTo, type TopicTree } from '@/features/topics/tree'
import { ChevronDownIcon } from '@/ui/icons'
import { TopicList } from '../TopicList'
import styles from './TopicPicker.module.css'

/**
 * The editor's Topic field: shows the topic's path, opens the tree with a search below it.
 * Picking another topic moves the card there when it is saved.
 */
export function TopicPicker({ tree, value, onChange }: { tree: TopicTree; value: Id; onChange(id: Id): void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const path = pathTo(tree, value).map((n) => n.topic.title).join(' / ')

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      button.current?.focus()
    }
    const node = root.current
    document.addEventListener('pointerdown', onPointer, true)
    node?.addEventListener('keydown', onKey)
    node?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      node?.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className={styles.picker} data-own-escape={open || undefined}>
      <button
        ref={button}
        type="button"
        className={styles.button}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('editor.topic')}: ${path}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.path}>{path || t('editor.pickTopic')}</span>
        <ChevronDownIcon size={16} />
      </button>
      {open && (
        <div className={styles.panel}>
          <TopicList
            tree={tree}
            selectedId={value}
            onPick={(id) => {
              onChange(id)
              setOpen(false)
              button.current?.focus()
            }}
          />
        </div>
      )}
    </div>
  )
}
