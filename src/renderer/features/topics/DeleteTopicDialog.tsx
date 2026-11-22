import { useTranslation } from 'react-i18next'
import { Button } from '@/ui/Button'
import { Modal } from '@/ui/Modal'
import { countSubtopics, type TopicNode } from './tree'
import { useTopicMutations } from './useTopics'

/** «Delete “JVM” with 3 subtopics and 24 cards?» — saying what goes with it, since it cannot come back. */
export function DeleteTopicDialog({
  node,
  onClose,
  onDeleted
}: {
  node: TopicNode | null
  onClose(): void
  onDeleted(node: TopicNode): void
}) {
  const { t } = useTranslation()
  const { remove } = useTopicMutations()
  if (!node) return null

  const subtopics = countSubtopics(node)
  const cards = node.totalCards
  const parts = [
    subtopics > 0 ? t('topics.subtopicsCount', { count: subtopics }) : null,
    // Its own key: Ukrainian needs the instrumental here («з 24 картками»).
    cards > 0 ? t('topics.cardsCount', { count: cards }) : null
  ].filter(Boolean)
  const title = node.topic.title
  const question =
    parts.length === 0
      ? t('topics.deleteConfirm', { title })
      : t('topics.deleteConfirmWith', { title, what: parts.join(t('common.and')) })

  const confirm = (): void => {
    remove.mutate(node.topic.id, { onSuccess: () => onDeleted(node) })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('topics.deleteTitle')}
      width={440}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={confirm} data-autofocus>
            {t('topics.delete')}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{question}</p>
    </Modal>
  )
}
