import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@/api/types'
import { can } from '@/features/topics/permissions'
import { pathTo, type TopicNode, type TopicTree } from '@/features/topics/tree'
import { SearchIcon } from '@/ui/icons'
import styles from './TopicList.module.css'

interface TopicListProps {
  tree: TopicTree
  selectedId: Id | null
  onPick(id: Id): void
  /** Shown but not pickable (the topic the card is already in). */
  disabledId?: Id
}

/**
 * The topic tree, flat and indented, with a search field on top: typing keeps the topics whose
 * name matches, with their parents for context. Only topics the user can add cards to are
 * pickable. Arrow keys move through the list from the search field; Enter picks.
 */
export function TopicList({ tree, selectedId, onPick, disabledId }: TopicListProps) {
  const { t } = useTranslation()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const all: TopicNode[] = []
    const walk = (nodes: TopicNode[]): void =>
      nodes.forEach((n) => {
        all.push(n)
        walk(n.children)
      })
    walk(tree.roots)
    if (!needle) return all
    const keep = new Set<Id>()
    for (const n of all) {
      if (n.topic.title.toLowerCase().includes(needle)) pathTo(tree, n.topic.id).forEach((p) => keep.add(p.topic.id))
    }
    return all.filter((n) => keep.has(n.topic.id))
  }, [tree, query])

  const pickable = (n: TopicNode): boolean => n.topic.id !== disabledId && can('edit', n.topic)
  const index = Math.min(active, rows.length - 1)

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = rows[index]
      if (row && pickable(row)) onPick(row.topic.id)
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.search}>
        <SearchIcon size={16} />
        <input
          value={query}
          placeholder={t('editor.searchTopics')}
          aria-label={t('editor.searchTopics')}
          aria-controls={listId}
          aria-activedescendant={rows[index] ? `${listId}-${rows[index].topic.id}` : undefined}
          data-autofocus
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      <ul id={listId} role="listbox" className={styles.list} aria-label={t('editor.topic')}>
        {rows.map((n, i) => (
          <li
            key={n.topic.id}
            id={`${listId}-${n.topic.id}`}
            role="option"
            aria-selected={n.topic.id === selectedId}
            aria-disabled={!pickable(n)}
            className={[styles.row, i === index ? styles.active : '', n.topic.id === selectedId ? styles.selected : '', pickable(n) ? '' : styles.disabled].join(' ')}
            style={{ paddingLeft: 12 + n.depth * 18 }}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickable(n) && onPick(n.topic.id)}
          >
            <span className={styles.title}>{n.topic.title}</span>
          </li>
        ))}
        {rows.length === 0 && <li className={styles.none}>{t('editor.noTopics')}</li>}
      </ul>
    </div>
  )
}
