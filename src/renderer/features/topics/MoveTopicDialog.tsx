import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@/api/types'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import styles from './MoveTopicDialog.module.css'
import { canCreateSubtopic } from './permissions'
import { subtreeIds, type TopicNode, type TopicTree } from './tree'
import { useTopicMutations } from './useTopics'

const ROOT = '__root__'

/** "Move to…": pick a new parent. The topic's own subtree is not offered, so no cycle can form. */
export function MoveTopicDialog({ tree, node, onClose }: { tree: TopicTree; node: TopicNode | null; onClose(): void }) {
  const { t } = useTranslation()
  const { move } = useTopicMutations()
  const [choice, setChoice] = useState<string | null>(null)
  if (!node) return null

  const excluded = subtreeIds(node)
  const options: TopicNode[] = []
  const walk = (nodes: TopicNode[]): void => {
    for (const n of nodes) {
      if (excluded.has(n.topic.id)) continue
      if (canCreateSubtopic(n.topic)) options.push(n)
      walk(n.children)
    }
  }
  walk(tree.roots)

  const current = node.topic.parentId ?? ROOT
  const selected = choice ?? current

  const confirm = (): void => {
    const parentId: Id | null = selected === ROOT ? null : selected
    const siblings = parentId ? (tree.byId.get(parentId)?.children ?? []) : tree.roots
    const order = siblings.filter((s) => s.topic.id !== node.topic.id).length
    move.mutate({ id: node.topic.id, parentId, order })
    setChoice(null)
    onClose()
  }

  const close = (): void => {
    setChoice(null)
    onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('topics.moveTitle', { title: node.topic.title })}
      width={440}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={confirm} disabled={selected === current}>
            {t('topics.move')}
          </Button>
        </>
      }
    >
      <div className={styles.list} role="radiogroup" aria-label={t('topics.moveTo')}>
        <label className={styles.option}>
          <input type="radio" name="parent" checked={selected === ROOT} onChange={() => setChoice(ROOT)} />
          <span className={styles.label}>{t('topics.moveRoot')}</span>
        </label>
        {options.map((n) => (
          <label key={n.topic.id} className={styles.option} style={{ paddingLeft: 12 + (n.depth + 1) * 18 }}>
            <input
              type="radio"
              name="parent"
              checked={selected === n.topic.id}
              onChange={() => setChoice(n.topic.id)}
            />
            <span className={styles.label} title={n.topic.title}>
              {n.topic.title}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
