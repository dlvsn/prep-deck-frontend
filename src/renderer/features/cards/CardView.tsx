import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Card, Topic } from '@/api/types'
import { can } from '@/features/topics/permissions'
import type { TopicTree } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { isTyping } from '@/ui/dialogLayer'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, MoreIcon, PencilIcon } from '@/ui/icons'
import { Menu } from '@/ui/Menu'
import dialog from './cardDialog.module.css'
import { isDue, topicPath } from './cardText'
import styles from './CardView.module.css'
import type { CardNav } from './editor/CardEditor'
import { DropOverlay } from './images/DropOverlay'
import { Gallery } from './images/Gallery'
import { filesOf, MAX_IMAGES } from './images/imagePrep'
import { Lightbox } from './images/Lightbox'
import { useFileDrop } from './images/useFileDrop'
import { useImageSlots } from './images/useImageSlots'
import { Markdown } from './markdown/Markdown'
import type { CardActions } from './useCardActions'
import { useCardMutations } from './useCards'

interface CardViewProps {
  tree: TopicTree
  card: Card
  topic: Topic
  nav: CardNav
  actions: CardActions
  closeRef: MutableRefObject<() => void>
  isTop(): boolean
  narrow: boolean
  onEdit(): void
  onClose(): void
}

/**
 * An open card (mockup 2; mockup 10 on a narrow window): question, tags, the answer and its
 * pictures. E edits, ← / → step through the topic's cards. With the right to edit, pictures
 * dropped or pasted here are added and saved straight away, without entering the editor.
 */
export function CardView({ tree, card, topic, nav, actions, closeRef, isTop, narrow, onEdit, onClose }: CardViewProps) {
  const { t } = useTranslation()
  const editable = can('edit', topic)
  const { update } = useCardMutations()
  const slots = useImageSlots(card.images)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const moreButton = useRef<HTMLButtonElement | null>(null)
  /** Pictures were added here and are to be saved once their uploads are done. */
  const [unsaved, setUnsaved] = useState(false)

  closeRef.current = onClose

  const add = (files: File[]): void => {
    if (!editable || slots.free === 0) return
    if (slots.addImages(files) > 0) setUnsaved(true)
  }

  // Saves once nothing is uploading; a failed slot waits for ↻ or ×, then this runs again.
  useEffect(() => {
    if (!unsaved || slots.uploading > 0 || slots.hasError) return
    setUnsaved(false)
    update.mutate({ card, patch: { imageIds: slots.imageIds }, images: slots.images })
  }, [unsaved, slots.uploading, slots.hasError, slots.imageIds, slots.images, card, update])

  const drop = useFileDrop(root, add)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!isTop() || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.key === 'e' || e.key === 'E') && editable) onEdit()
      else if (e.key === 'ArrowLeft' && nav.total > 1) nav.prev()
      else if (e.key === 'ArrowRight' && nav.total > 1) nav.next()
      else return
      e.preventDefault()
    }
    const onPaste = (e: ClipboardEvent): void => {
      if (!isTop() || !editable) return
      const images = filesOf(e.clipboardData?.items).filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      add(images)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('paste', onPaste)
    }
  })

  const menuItems = actions.menu(card, topic)
  const showGallery = slots.slots.length > 0

  return (
    <div ref={root} className={`${dialog.root} ${dialog.content}`}>
      <header className={dialog.header}>
        <div className={dialog.headerStart}>
          {narrow && <Button variant="ghost" iconOnly icon={<ArrowLeftIcon size={20} />} aria-label={t('cards.back')} onClick={onClose} />}
          {!narrow && <span className={dialog.crumbs}>{topicPath(tree, card.topicId)}</span>}
          <span className={dialog.badge} data-status={card.status}>
            {t(`cards.status.${card.status}`)}
          </span>
          {isDue(card) && <span className={styles.due}>{t('cards.dueToday')}</span>}
        </div>

        <div className={dialog.actions}>
          {editable && (
            <Button icon={<PencilIcon size={16} />} onClick={onEdit} title={t('cards.editHint')}>
              {t('cards.edit')}
            </Button>
          )}
          {menuItems.length > 0 && (
            <Button
              variant="ghost"
              iconOnly
              icon={<MoreIcon size={18} />}
              aria-label={t('cards.actions')}
              aria-haspopup="menu"
              onClick={(e) => {
                moreButton.current = e.currentTarget
                const rect = e.currentTarget.getBoundingClientRect()
                setMenuAt({ x: rect.left, y: rect.bottom + 4 })
              }}
            />
          )}
          {!narrow && (
            <>
              <span className={dialog.divider} />
              <div className={dialog.nav}>
                <Button iconOnly icon={<ChevronLeftIcon size={18} />} aria-label={t('cards.previous')} onClick={nav.prev} disabled={nav.total < 2} />
                <span className={dialog.position}>{t('cards.position', { index: nav.index + 1, total: nav.total })}</span>
                <Button iconOnly icon={<ChevronRightIcon size={18} />} aria-label={t('cards.next')} onClick={nav.next} disabled={nav.total < 2} />
              </div>
              <Button variant="ghost" iconOnly icon={<CloseIcon size={18} />} aria-label={t('common.close')} onClick={onClose} data-autofocus />
            </>
          )}
        </div>
      </header>

      <div className={`${dialog.body} ${showGallery ? '' : dialog.single}`}>
        <article className={dialog.main}>
          <h2 className={styles.question}>{card.question}</h2>
          {card.tags.length > 0 && (
            <ul className={styles.tags} aria-label={t('editor.tags')}>
              {card.tags.map((tag) => (
                <li key={tag}>#{tag}</li>
              ))}
            </ul>
          )}
          {card.answer.trim() ? <Markdown source={card.answer} /> : <p className={styles.noAnswer}>{t('cards.noAnswer')}</p>}
        </article>

        {showGallery && (
          <aside className={dialog.side} aria-label={t('images.title')}>
            <Gallery
              slots={slots.slots}
              editable={false}
              onRemove={slots.remove}
              onRetry={slots.retry}
              onOpen={setLightbox}
              footer={<span>{t('images.count', { count: slots.images.length })}</span>}
            />
          </aside>
        )}
      </div>

      {drop.active &&
        (!editable ? (
          <DropOverlay text={t('images.dropViewOnly')} muted />
        ) : slots.free > 0 ? (
          <DropOverlay text={t('images.dropUpload', { free: slots.free, max: MAX_IMAGES })} />
        ) : (
          <DropOverlay text={t('images.dropFull', { max: MAX_IMAGES })} muted />
        ))}

      {lightbox !== null && slots.slots.length > 0 && (
        <Lightbox
          urls={slots.slots.map((s) => s.preview)}
          index={Math.min(lightbox, slots.slots.length - 1)}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <Menu
        at={menuAt}
        items={menuItems}
        label={t('cards.actions')}
        onClose={(selected) => {
          setMenuAt(null)
          if (!selected) moreButton.current?.focus()
        }}
      />
    </div>
  )
}
