import { useTranslation } from 'react-i18next'
import type { TopicNode } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { useToasts } from '@/ui/toast'
import { useSharedMutations } from './useShared'

/** Gives up a share: the topic and its subtopics leave Shared with me. Asked first. */
export function LeaveTopicDialog({
  node,
  onClose,
  onLeft
}: {
  node: TopicNode | null
  onClose(): void
  onLeft(node: TopicNode): void
}) {
  const { t } = useTranslation()
  const { leave } = useSharedMutations()
  if (!node) return null

  const confirm = (): void => {
    leave.mutate(node.topic.id, {
      onSuccess: () => {
        useToasts.getState().show(t('shared.left', { title: node.topic.title }))
        onLeft(node)
      }
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('shared.leaveTitle')}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={confirm} data-autofocus>
            {t('shared.leave')}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{t('shared.leaveConfirm', { title: node.topic.title, owner: node.topic.owner.name })}</p>
    </Modal>
  )
}
