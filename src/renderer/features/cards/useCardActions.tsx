import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Card, Id, Topic } from '@/api/types'
import { can } from '@/features/topics/permissions'
import type { TopicTree } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { CopyIcon, EyeIcon, MoveIcon, PencilIcon, TrashIcon } from '@/ui/icons'
import type { MenuItem } from '@/ui/Menu'
import { Modal } from '@/ui/Modal'
import { useToasts } from '@/ui/toast'
import { useCardModal } from './cardModalStore'
import { copyQuestion, topicPath } from './cardText'
import { TopicList } from './TopicList'
import { useCardMutations } from './useCards'

interface CardActionsOptions {
  /** After the card left its topic (moved or deleted): the open card dialog steps to another. */
  onGone?(card: Card): void
}

export interface CardActions {
  duplicate(card: Card): void
  move(card: Card): void
  remove(card: Card): void
  /** The menu of a card (right click on the grid, ⋯ in the dialog), only what the role allows. */
  menu(card: Card, topic: Topic, extra?: { open?(): void; edit?(): void }): MenuItem[]
  /** The Move and Delete dialogs; render them once. */
  dialogs: ReactNode
}

/** Duplicate, Move to… and Delete, the same wherever a card offers them. */
export function useCardActions(tree: TopicTree, { onGone }: CardActionsOptions = {}): CardActions {
  const { t } = useTranslation()
  const { update, remove, duplicate } = useCardMutations()
  const openCard = useCardModal((s) => s.openCard)
  const [moving, setMoving] = useState<Card | null>(null)
  const [target, setTarget] = useState<Id | null>(null)
  const [deleting, setDeleting] = useState<Card | null>(null)

  const duplicateCard = (card: Card): void => {
    const question = copyQuestion(card.question, (q) => t('cards.copyOf', { question: q }))
    duplicate.mutate({ card, question }, { onSuccess: (copy) => openCard(copy.topicId, copy.id, 'edit') })
  }

  const closeMove = (): void => {
    setMoving(null)
    setTarget(null)
  }

  const confirmMove = (): void => {
    if (!moving || !target) return
    update.mutate({ card: moving, patch: { topicId: target } })
    useToasts.getState().show(t('cards.movedTo', { path: topicPath(tree, target) }))
    onGone?.(moving)
    closeMove()
  }

  const confirmDelete = (): void => {
    if (!deleting) return
    remove.mutate(deleting)
    onGone?.(deleting)
    setDeleting(null)
  }

  const menu: CardActions['menu'] = (card, topic, extra = {}) => {
    const editable = can('edit', topic)
    const items: Array<MenuItem & { allowed: boolean }> = [
      { id: 'open', label: t('cards.open'), icon: <EyeIcon size={16} />, allowed: extra.open !== undefined, onSelect: () => extra.open?.() },
      { id: 'edit', label: t('cards.edit'), icon: <PencilIcon size={16} />, allowed: editable && extra.edit !== undefined, onSelect: () => extra.edit?.() },
      { id: 'duplicate', label: t('cards.duplicate'), icon: <CopyIcon size={16} />, allowed: editable, onSelect: () => duplicateCard(card) },
      { id: 'move', label: t('cards.moveTo'), icon: <MoveIcon size={16} />, allowed: editable, onSelect: () => setMoving(card) },
      { id: 'delete', label: t('cards.delete'), icon: <TrashIcon size={16} />, danger: true, allowed: editable, onSelect: () => setDeleting(card) }
    ]
    return items.filter((item) => item.allowed)
  }

  const dialogs = (
    <>
      <Modal
        open={moving !== null}
        onClose={closeMove}
        title={t('cards.moveTitle')}
        subtitle={moving?.question}
        width={460}
        footer={
          <>
            <Button onClick={closeMove}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={confirmMove} disabled={!target}>
              {t('cards.moveAction')}
            </Button>
          </>
        }
      >
        {moving && <TopicList tree={tree} selectedId={target} disabledId={moving.topicId} onPick={setTarget} />}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('cards.deleteTitle')}
        width={420}
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={confirmDelete} data-autofocus>
              {t('cards.delete')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{t('cards.deleteConfirm')}</p>
      </Modal>
    </>
  )

  return { duplicate: duplicateCard, move: setMoving, remove: setDeleting, menu, dialogs }
}
