import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Card } from '@/api/types'
import { can } from '@/features/topics/permissions'
import type { TopicNode, TopicTree } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { anyLayerOpen, isTyping } from '@/ui/dialogLayer'
import { ImageIcon, PlusIcon } from '@/ui/icons'
import { Menu } from '@/ui/Menu'
import { useCardModal } from './cardModalStore'
import styles from './CardsSection.module.css'
import { isDue, plainText } from './cardText'
import { DropOverlay } from './images/DropOverlay'
import { useFileDrop } from './images/useFileDrop'
import { useCardActions } from './useCardActions'
import { cardKey, isPendingCard, useTopicCards } from './useCards'

/** How long a card that left the grid (moved, deleted) takes to fade out. */
const LEAVE_MS = 250
/** The grid rises card by card when a topic opens: 40 ms apart, the first twelve. */
const STAGGER_MS = 40
const STAGGERED = 12

interface Shown {
  card: Card
  key: string
  leaving: boolean
}

/**
 * Keeps cards that just left the list on screen for a moment with `leaving` set, at the place
 * they had, so they can fade out instead of vanishing.
 */
function usePresence(cards: Card[]): Shown[] {
  const previous = useRef<Card[]>(cards)
  const [leaving, setLeaving] = useState<Array<{ card: Card; index: number }>>([])

  useLayoutEffect(() => {
    const now = new Set(cards.map(cardKey))
    const left = previous.current
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !now.has(cardKey(card)) && !isPendingCard(card))
    previous.current = cards
    if (left.length === 0) return
    setLeaving((current) => [...current, ...left])
    const timer = window.setTimeout(() => {
      const gone = new Set(left.map((l) => cardKey(l.card)))
      setLeaving((current) => current.filter((l) => !gone.has(cardKey(l.card))))
    }, LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [cards])

  const shown: Shown[] = cards.map((card) => ({ card, key: cardKey(card), leaving: false }))
  const present = new Set(shown.map((s) => s.key))
  for (const { card, index } of leaving) {
    if (!present.has(cardKey(card))) shown.splice(Math.min(index, shown.length), 0, { card, key: cardKey(card), leaving: true })
  }
  return shown
}

/**
 * The cards of the open topic (mockup 1): a grid of cards, newest first. A click opens one,
 * a right click (or the context-menu key) offers its actions, N starts a new card, and pictures
 * dropped on the grid start a new card with them.
 */
export function CardsSection({ tree, node }: { tree: TopicTree; node: TopicNode }) {
  const { t } = useTranslation()
  const topic = node.topic
  const editable = can('edit', topic)
  const { openCreate, openCard } = useCardModal.getState()
  const query = useTopicCards(topic.id)
  const cards = query.data ?? []
  const shown = usePresence(cards)
  const actions = useCardActions(tree)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; card: Card } | null>(null)
  const section = useRef<HTMLElement>(null)

  // Cards present when the topic first showed rise in a stagger; later ones rise on their own.
  const initialKeys = useRef<Set<string> | null>(null)
  if (initialKeys.current === null && query.isSuccess) initialKeys.current = new Set(cards.map(cardKey))

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== 'n' && e.key !== 'N') return
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || anyLayerOpen()) return
      if (document.querySelector('[role=menu]') || !editable) return
      e.preventDefault()
      openCreate(topic.id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editable, topic.id, openCreate])

  const drop = useFileDrop(section, (files) => {
    if (editable && files.length > 0) openCreate(topic.id, files)
  })

  const open = (card: Card): void => {
    if (!isPendingCard(card)) openCard(topic.id, card.id)
  }

  const openMenu = (card: Card, at: { x: number; y: number }): void => {
    if (isPendingCard(card)) return
    setMenu({ at, card })
  }

  const onTileKey = (e: KeyboardEvent<HTMLElement>, card: Card): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(card)
    } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      openMenu(card, { x: rect.left + 16, y: rect.top + 40 })
    } else if ((e.key === 'e' || e.key === 'E') && editable && !e.ctrlKey && !e.metaKey && !isPendingCard(card)) {
      e.preventDefault()
      openCard(topic.id, card.id, 'edit')
    }
  }

  return (
    <section ref={section} className={styles.section} aria-label={t('cards.title')} aria-busy={query.isLoading}>
      {query.isLoading && (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      )}

      {query.isSuccess && cards.length === 0 && shown.length === 0 && (
        <div className={styles.empty}>
          <ImageIcon size={28} />
          <h2 className={styles.emptyTitle}>{t('cards.empty')}</h2>
          <p>{editable ? t('cards.emptyBody') : t('cards.emptyViewOnly')}</p>
          {editable && (
            <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => openCreate(topic.id)}>
              {t('cards.new')}
            </Button>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <ul className={styles.grid}>
          {shown.map(({ card, key, leaving }, i) => {
            const initial = initialKeys.current?.has(key) ?? true
            const style: CSSProperties | undefined =
              initial && i < STAGGERED ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined
            const pending = isPendingCard(card)
            return (
              <li key={key} className={`${styles.cell} ${leaving ? styles.leaving : ''}`} style={style}>
                <article
                  className={`${styles.tile} ${pending ? styles.pending : ''}`}
                  tabIndex={leaving ? -1 : 0}
                  aria-label={card.question}
                  aria-busy={pending || undefined}
                  onClick={() => open(card)}
                  onKeyDown={(e) => onTileKey(e, card)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openMenu(card, { x: e.clientX, y: e.clientY })
                  }}
                >
                  <div className={styles.tileTop}>
                    <span className={styles.status} data-status={card.status}>
                      {t(`cards.status.${card.status}`)}
                    </span>
                    {isDue(card) && <span className={styles.due}>{t('cards.dueToday')}</span>}
                  </div>
                  <h3 className={styles.question}>{card.question}</h3>
                  {card.answer && <p className={styles.answer}>{plainText(card.answer)}</p>}
                  <div className={styles.tileBottom}>
                    <ul className={styles.tags}>
                      {card.tags.slice(0, 3).map((tag) => (
                        <li key={tag}>#{tag}</li>
                      ))}
                    </ul>
                    {card.images.length > 0 && (
                      <span className={styles.images} aria-label={t('images.count', { count: card.images.length })}>
                        <ImageIcon size={15} />
                        {card.images.length}
                      </span>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {drop.active &&
        (editable ? <DropOverlay text={t('images.dropCreate')} /> : <DropOverlay text={t('images.dropViewOnly')} muted />)}

      <Menu
        at={menu?.at ?? null}
        items={
          menu
            ? actions.menu(menu.card, topic, {
                open: () => open(menu.card),
                edit: () => openCard(topic.id, menu.card.id, 'edit')
              })
            : []
        }
        label={t('cards.actions')}
        onClose={() => setMenu(null)}
      />
      {actions.dialogs}
    </section>
  )
}
