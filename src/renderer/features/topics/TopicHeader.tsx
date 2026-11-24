import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCardModal } from '@/features/cards/cardModalStore'
import { Button } from '@/ui/Button'
import { PlusIcon } from '@/ui/icons'
import { can } from './permissions'
import styles from './TopicHeader.module.css'
import { pathTo, type TopicNode, type TopicTree } from './tree'
import { useTopicMutations } from './useTopics'

/**
 * Breadcrumbs, the topic's name (double-click to rename) and New card. The progress bar and the
 * Share and Practice buttons join it with practice (stage 5) and sharing (stage 6).
 */
export function TopicHeader({ tree, node, onNavigate }: { tree: TopicTree; node: TopicNode; onNavigate(id: string): void }) {
  const { t } = useTranslation()
  const { rename } = useTopicMutations()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const path = pathTo(tree, node.topic.id)

  const start = (): void => {
    if (!can('edit', node.topic)) return
    setValue(node.topic.title)
    setEditing(true)
  }
  const finish = (save: boolean): void => {
    setEditing(false)
    const title = value.trim()
    if (save && title && title !== node.topic.title) rename.mutate({ id: node.topic.id, title })
  }

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <nav className={styles.crumbs} aria-label={t('topics.breadcrumbs')}>
            {path.map((n, i) => (
              <span key={n.topic.id} className={styles.crumb}>
                {i > 0 && <span className={styles.sep}>/</span>}
                {i < path.length - 1 ? (
                  <button type="button" className={styles.crumbLink} onClick={() => onNavigate(n.topic.id)}>
                    {n.topic.title}
                  </button>
                ) : (
                  <span aria-current="page">{n.topic.title}</span>
                )}
              </span>
            ))}
          </nav>

          {editing ? (
            <input
              className={styles.titleInput}
              value={value}
              autoFocus
              aria-label={t('topics.rename')}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finish(true)
                if (e.key === 'Escape') finish(false)
              }}
              onBlur={() => finish(true)}
            />
          ) : (
            <h1
              className={styles.title}
              onDoubleClick={start}
              title={can('edit', node.topic) ? t('topics.renameHint') : undefined}
            >
              {node.topic.title}
            </h1>
          )}

          <p className={styles.summary}>{t('cards.count', { count: node.totalCards })}</p>
        </div>
        {can('edit', node.topic) && (
          <Button
            className={styles.newCard}
            icon={<PlusIcon size={18} />}
            onClick={() => useCardModal.getState().openCreate(node.topic.id)}
            title={t('cards.newHint')}
          >
            {t('cards.new')}
          </Button>
        )}
      </div>
    </header>
  )
}
