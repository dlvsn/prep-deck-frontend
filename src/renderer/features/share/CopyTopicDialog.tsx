import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Id } from '@/api/types'
import moveStyles from '@/features/topics/MoveTopicDialog.module.css'
import { can } from '@/features/topics/permissions'
import type { TopicNode } from '@/features/topics/tree'
import { useMyTopics } from '@/features/topics/useTopics'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { useToasts } from '@/ui/toast'
import { useSharedMutations } from './useShared'

const ROOT = '__root__'

/**
 * "Copy to my topics": the topic with its subtopics, cards and pictures becomes the user's own,
 * under the topic they pick (the top level unless they choose otherwise). Opens the copy after.
 */
export function CopyTopicDialog({ node, onClose }: { node: TopicNode | null; onClose(): void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { tree } = useMyTopics()
  const { copyToMine } = useSharedMutations()
  const [choice, setChoice] = useState<string>(ROOT)
  if (!node) return null

  const options: TopicNode[] = []
  const walk = (nodes: TopicNode[]): void => {
    for (const n of nodes) {
      if (can('edit', n.topic)) options.push(n)
      walk(n.children)
    }
  }
  walk(tree?.roots ?? [])

  const close = (): void => {
    setChoice(ROOT)
    onClose()
  }

  const confirm = (): void => {
    const parentId: Id | null = choice === ROOT ? null : choice
    copyToMine.mutate(
      { topicId: node.topic.id, parentId },
      {
        onSuccess: (copy) => {
          useToasts.getState().show(t('shared.copied', { title: node.topic.title }))
          close()
          navigate(`/topics/${copy.id}`)
        }
      }
    )
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('shared.copyTitle', { title: node.topic.title })}
      subtitle={t('shared.copySub')}
      width={440}
      footer={
        <>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={confirm} busy={copyToMine.isPending} data-autofocus>
            {t('shared.copyAction')}
          </Button>
        </>
      }
    >
      <div className={moveStyles.list} role="radiogroup" aria-label={t('shared.copyWhere')}>
        <label className={moveStyles.option}>
          <input type="radio" name="copy-parent" checked={choice === ROOT} onChange={() => setChoice(ROOT)} />
          <span className={moveStyles.label}>{t('topics.moveRoot')}</span>
        </label>
        {options.map((n) => (
          <label key={n.topic.id} className={moveStyles.option} style={{ paddingLeft: 12 + (n.depth + 1) * 18 }}>
            <input type="radio" name="copy-parent" checked={choice === n.topic.id} onChange={() => setChoice(n.topic.id)} />
            <span className={moveStyles.label} title={n.topic.title}>
              {n.topic.title}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  )
}
