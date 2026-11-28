import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCardModal } from '@/features/cards/cardModalStore'
import { CopyTopicDialog } from '@/features/share/CopyTopicDialog'
import { useShareDialog } from '@/features/share/shareDialogStore'
import { Button } from '@/ui/Button'
import { CopyIcon, PlusIcon, ShareIcon } from '@/ui/icons'
import { can } from './permissions'
import styles from './TopicHeader.module.css'
import { pathTo, type TopicNode, type TopicTree } from './tree'
import { useTopicMutations } from './useTopics'

/**
 * Breadcrumbs, the topic's name (double-click to rename) and the actions the role allows: Share
 * and New card on one's own topic; on a shared one its role and Copy to my topics. The progress
 * bar and Practice join it with practice (stage 5).
 */
export function TopicHeader({ tree, node, onNavigate }: { tree: TopicTree; node: TopicNode; onNavigate(id: string): void }) {
  const { t } = useTranslation()
  const { rename } = useTopicMutations()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [copying, setCopying] = useState(false)
  const path = pathTo(tree, node.topic.id)
  const topic = node.topic
  // A shared topic is named from its owner down, through the parents the user cannot open.
  const lead = topic.role === 'owner' ? [] : [topic.owner.name, ...path[0].topic.path]

  const start = (): void => {
    if (!can('edit', topic)) return
    setValue(topic.title)
    setEditing(true)
  }
  const finish = (save: boolean): void => {
    setEditing(false)
    const title = value.trim()
    if (save && title && title !== topic.title) rename.mutate({ id: topic.id, title })
  }

  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <div className={styles.crumbLine}>
            <nav className={styles.crumbs} aria-label={t('topics.breadcrumbs')}>
              {lead.map((title, i) => (
                <span key={`lead-${i}`} className={styles.crumb}>
                  {i > 0 && <span className={styles.sep}>/</span>}
                  <span>{title}</span>
                </span>
              ))}
              {path.map((n, i) => (
                <span key={n.topic.id} className={styles.crumb}>
                  {(i > 0 || lead.length > 0) && <span className={styles.sep}>/</span>}
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
            {topic.role !== 'owner' && (
              <span className={styles.role}>{t(topic.role === 'viewer' ? 'share.canView' : 'share.canEdit')}</span>
            )}
          </div>

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
            <h1 className={styles.title} onDoubleClick={start} title={can('edit', topic) ? t('topics.renameHint') : undefined}>
              {topic.title}
            </h1>
          )}

          <p className={styles.summary}>{t('cards.count', { count: node.totalCards })}</p>
        </div>

        <div className={styles.actions}>
          {can('share', topic) && (
            <Button icon={<ShareIcon size={16} />} onClick={() => useShareDialog.getState().open(topic.id)}>
              {t('topics.share')}
            </Button>
          )}
          {can('copy', topic) && (
            <Button icon={<CopyIcon size={16} />} onClick={() => setCopying(true)}>
              {t('shared.copy')}
            </Button>
          )}
          {can('edit', topic) && (
            <Button
              className={styles.newCard}
              icon={<PlusIcon size={18} />}
              onClick={() => useCardModal.getState().openCreate(topic.id)}
              title={t('cards.newHint')}
            >
              {t('cards.new')}
            </Button>
          )}
        </div>
      </div>
      <CopyTopicDialog node={copying ? node : null} onClose={() => setCopying(false)} />
    </header>
  )
}
