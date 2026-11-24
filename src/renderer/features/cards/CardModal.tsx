import { useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Card, Id } from '@/api/types'
import { useLayoutMode } from '@/app/useLayoutMode'
import { can } from '@/features/topics/permissions'
import type { TopicTree } from '@/features/topics/tree'
import { useDialogLayer } from '@/ui/dialogLayer'
import { useCardModal } from './cardModalStore'
import styles from './CardModal.module.css'
import { CardView } from './CardView'
import { CardEditor, type CardNav } from './editor/CardEditor'
import { useCardActions } from './useCardActions'
import { isPendingCard, useTopicCards } from './useCards'

/**
 * The card dialog, rendered once on the topics page and driven by {@link useCardModal}: a new
 * card's editor, or an open card that switches between viewing and editing in place (a 200 ms
 * fade, the dialog stays). On a narrow window it fills the window.
 */
export function CardModal({ tree }: { tree: TopicTree }) {
  const { t } = useTranslation()
  const state = useCardModal((s) => s.state)
  const { openCard, openCreate, setMode, close } = useCardModal.getState()
  const narrow = useLayoutMode() === 'narrow'
  const open = state.kind !== 'closed'

  const box = useRef<HTMLDivElement>(null)
  // The content in charge decides how to close (the editor asks first when there are changes).
  const closeRef = useRef<() => void>(close)
  const isTop = useDialogLayer(open, box, () => closeRef.current())

  const topicId = state.kind === 'closed' ? null : state.topicId
  const topicNode = topicId ? tree.byId.get(topicId) : undefined
  const cards = useTopicCards(state.kind === 'card' ? state.topicId : null)
  const list = useMemo(() => (cards.data ?? []).filter((c) => !isPendingCard(c)), [cards.data])
  const card = state.kind === 'card' ? list.find((c) => c.id === state.cardId) : undefined

  // The topic or the card went away (deleted, moved elsewhere): nothing left to show.
  const gone = open && (!topicNode || (state.kind === 'card' && cards.isSuccess && !card))
  useEffect(() => {
    if (gone) close()
  }, [gone, close])

  const index = card ? list.indexOf(card) : -1
  const go = useCallback(
    (delta: number) => {
      if (state.kind !== 'card' || list.length < 2 || index < 0) return
      const next = list[(index + delta + list.length) % list.length]
      openCard(state.topicId, next.id, state.mode)
    },
    [state, list, index, openCard]
  )
  const nav: CardNav = { index: Math.max(0, index), total: list.length, prev: () => go(-1), next: () => go(1) }

  /** After the open card was deleted or moved: the next one in the topic, else the dialog closes. */
  const stepAway = (removed: Card): void => {
    const current = useCardModal.getState().state
    if (current.kind !== 'card' || current.cardId !== removed.id) return
    const rest = list.filter((c) => c.id !== removed.id)
    const at = list.findIndex((c) => c.id === removed.id)
    const next = rest[Math.min(at, rest.length - 1)]
    if (next) openCard(current.topicId, next.id, 'view')
    else close()
  }
  const actions = useCardActions(tree, { onGone: stepAway })

  if (!open || !topicNode || gone) return null

  const topic = topicNode.topic
  const saveAndNew = (target: Id, tags: string[]): void => openCreate(target, [], tags)

  let content
  let label: string
  if (state.kind === 'create') {
    label = t('editor.newTitle')
    content = (
      <CardEditor
        key={`new-${state.session}`}
        tree={tree}
        card={null}
        topicId={state.topicId}
        initialFiles={state.files}
        initialTags={state.tags}
        closeRef={closeRef}
        isTop={isTop}
        nav={null}
        narrow={narrow}
        onClosed={close}
        onSaveAndNew={saveAndNew}
      />
    )
  } else if (card && state.mode === 'edit' && can('edit', topic)) {
    label = card.question
    content = (
      <CardEditor
        key={`edit-${card.id}`}
        tree={tree}
        card={card}
        topicId={card.topicId}
        initialFiles={[]}
        initialTags={[]}
        closeRef={closeRef}
        isTop={isTop}
        nav={nav}
        narrow={narrow}
        onClosed={close}
        onSaveAndNew={saveAndNew}
      />
    )
  } else if (card) {
    label = card.question
    content = (
      <CardView
        key={`view-${card.id}`}
        tree={tree}
        card={card}
        topic={topic}
        nav={nav}
        actions={actions}
        closeRef={closeRef}
        isTop={isTop}
        narrow={narrow}
        onEdit={() => setMode('edit')}
        onClose={close}
      />
    )
  } else {
    label = t('cards.loading')
    content = <div className={styles.loading} aria-busy="true" />
  }

  return createPortal(
    <>
      <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
        <div ref={box} role="dialog" aria-modal="true" aria-label={label} className={styles.box}>
          {content}
        </div>
      </div>
      {actions.dialogs}
    </>,
    document.body
  )
}
