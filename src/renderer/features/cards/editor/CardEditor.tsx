import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { Card, Id } from '@/api/types'
import { useSession } from '@/app/session'
import type { TopicTree } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon, UploadIcon } from '@/ui/icons'
import { Modal } from '@/ui/Modal'
import dialog from '../cardDialog.module.css'
import { MAX_ANSWER, MAX_QUESTION, topicPath } from '../cardText'
import { clearDraft, draftTarget, readDraft, writeDraft, type CardDraftSnapshot, type DraftRef } from '../drafts'
import { DropOverlay } from '../images/DropOverlay'
import { Gallery } from '../images/Gallery'
import { ACCEPT_ATTRIBUTE, ACCEPTED_TYPES, filesOf, MAX_IMAGES } from '../images/imagePrep'
import { Lightbox } from '../images/Lightbox'
import { useFileDrop } from '../images/useFileDrop'
import { useImageSlots } from '../images/useImageSlots'
import { Markdown } from '../markdown/Markdown'
import { applyMarkdown, shortcutAction, type MarkdownAction } from '../markdown/markdownEdit'
import { useCardMutations, useCardTags } from '../useCards'
import styles from './CardEditor.module.css'
import { TagInput } from './TagInput'
import { TopicPicker } from './TopicPicker'

/** Moving between cards of the topic from the editor's header. */
export interface CardNav {
  index: number
  total: number
  prev(): void
  next(): void
}

interface CardEditorProps {
  tree: TopicTree
  /** Null: a new card. */
  card: Card | null
  /** Where a new card goes (the picker can change it). */
  topicId: Id
  /** Dropped on the grid: they start uploading as the editor opens. */
  initialFiles: File[]
  /** Save & new keeps the tags of the card just saved. */
  initialTags: string[]
  /** The modal calls this for Escape, the scrim and ×: it asks first when there are changes. */
  closeRef: MutableRefObject<() => void>
  isTop(): boolean
  nav: CardNav | null
  narrow: boolean
  onClosed(): void
  onSaveAndNew(topicId: Id, tags: string[]): void
}

const AUTOSAVE_MS = 2000

const TOOLBAR: Array<{ action: MarkdownAction; glyph: string; label: 'bold' | 'italic' | 'code' | 'bullets' | 'numbers' | 'heading' | 'link' }> = [
  { action: 'bold', glyph: 'B', label: 'bold' },
  { action: 'italic', glyph: 'I', label: 'italic' },
  { action: 'code', glyph: '</>', label: 'code' },
  { action: 'bullets', glyph: '•', label: 'bullets' },
  { action: 'numbers', glyph: '1.', label: 'numbers' },
  { action: 'heading', glyph: 'H', label: 'heading' },
  { action: 'link', glyph: '↗', label: 'link' }
]

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Creating and editing a card (mockup 3): topic, question, Markdown answer with a toolbar and a
 * preview, tags, and up to five pictures that upload as soon as they are added. The content is
 * kept as a local draft every two seconds and offered back after a crash.
 */
export function CardEditor({ tree, card, topicId, initialFiles, initialTags, closeRef, isTop, nav, narrow, onClosed, onSaveAndNew }: CardEditorProps) {
  const { t } = useTranslation()
  const userId = useSession((s) => s.user?.id ?? 'anonymous')
  const { create, update } = useCardMutations()
  const tagSuggestions = useCardTags().data ?? []

  // Fixed for the editor's lifetime: what it opened with, and where its draft lives.
  const [initial] = useState(() => ({
    topicId: card?.topicId ?? topicId,
    question: card?.question ?? '',
    answer: card?.answer ?? '',
    tags: card?.tags ?? initialTags,
    imageIds: card?.images.map((i) => i.id) ?? []
  }))
  const [draftRef] = useState<DraftRef>(() => ({ userId, target: draftTarget(card?.id ?? null, initial.topicId) }))

  const [topic, setTopic] = useState(initial.topicId)
  const [question, setQuestion] = useState(initial.question)
  const [answer, setAnswer] = useState(initial.answer)
  const [tags, setTags] = useState(initial.tags)
  const slots = useImageSlots(card?.images ?? [])

  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [questionError, setQuestionError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [flashErrors, setFlashErrors] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  /** Set while "Discard changes?" is open: what to do once the user agrees. */
  const [pending, setPending] = useState<(() => void) | null>(null)
  const [restorable, setRestorable] = useState<CardDraftSnapshot | null>(() => {
    const found = readDraft(draftRef)
    if (!found) return null
    const differs =
      found.question !== initial.question ||
      found.answer !== initial.answer ||
      !sameList(found.tags, initial.tags) ||
      !sameList(found.images.map((i) => i.id), initial.imageIds)
    return differs ? found : null
  })

  const root = useRef<HTMLDivElement>(null)
  const questionInput = useRef<HTMLInputElement>(null)
  const answerArea = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const saved = useRef(false)

  const slotIds = slots.slots.map((s) => s.image?.id ?? s.key)
  const dirty =
    topic !== initial.topicId ||
    question !== initial.question ||
    answer !== initial.answer ||
    !sameList(tags, initial.tags) ||
    !sameList(slotIds, initial.imageIds)

  const snapshot = useCallback(
    (): CardDraftSnapshot => ({ topicId: topic, question, answer, tags, images: slots.current(), savedAt: Date.now() }),
    [topic, question, answer, tags, slots]
  )

  // ---------------------------------------------------------------- lifecycle

  useEffect(() => {
    mounted.current = true
    questionInput.current?.focus()
    return () => {
      mounted.current = false
    }
  }, [])

  const filesTaken = useRef(false)
  useEffect(() => {
    if (filesTaken.current || initialFiles.length === 0) return
    filesTaken.current = true
    slots.addImages(initialFiles)
  }, [initialFiles, slots])

  // The draft: every two seconds while there are unsaved changes.
  const latest = useRef({ dirty, snapshot })
  latest.current = { dirty, snapshot }
  useEffect(() => {
    let written = ''
    const timer = window.setInterval(() => {
      if (saved.current || !latest.current.dirty) return
      const draft = latest.current.snapshot()
      const serialized = JSON.stringify({ ...draft, savedAt: 0 })
      if (serialized === written) return
      written = serialized
      writeDraft(draftRef, draft)
    }, AUTOSAVE_MS)
    return () => window.clearInterval(timer)
  }, [draftRef])

  // Ctrl+V with a picture on the clipboard (a screenshot) adds it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      if (!isTop()) return
      const images = filesOf(e.clipboardData?.items).filter((f) => (ACCEPTED_TYPES as readonly string[]).includes(f.type) || f.type.startsWith('image/'))
      if (images.length === 0) return
      e.preventDefault()
      slots.addImages(images)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [isTop, slots])

  const drop = useFileDrop(root, (files) => {
    if (slots.free > 0) slots.addImages(files)
  })

  // ---------------------------------------------------------------- closing

  /** Runs `then` right away, or after "Discard changes?" when there is something to lose. */
  const guard = useCallback(
    (then: () => void) => {
      if (!dirty || saving) then()
      else
        setPending(() => () => {
          clearDraft(draftRef)
          then()
        })
    },
    [dirty, saving, draftRef]
  )

  const requestClose = useCallback(() => guard(onClosed), [guard, onClosed])
  closeRef.current = requestClose

  // ---------------------------------------------------------------- saving

  const save = async (andNew: boolean): Promise<void> => {
    if (saving) return
    const text = question.trim()
    if (!text) {
      setQuestionError(true)
      questionInput.current?.focus()
      return
    }
    setSaving(true)
    const ok = await slots.waitForUploads()
    if (!mounted.current) return
    if (!ok) {
      setSaving(false)
      setFlashErrors(true)
      window.setTimeout(() => mounted.current && setFlashErrors(false), 600)
      return
    }

    const images = slots.current()
    const content = { question: text, answer, tags, imageIds: images.map((i) => i.id) }
    const draftBackup = { ref: draftRef, snapshot: { ...snapshot(), images } }
    saved.current = true
    clearDraft(draftRef)
    if (card) {
      update.mutate({ card, patch: topic === card.topicId ? content : { ...content, topicId: topic }, images, draftBackup })
    } else {
      create.mutate({ topicId: topic, draft: content, images, draftBackup })
    }
    if (andNew) onSaveAndNew(topic, tags)
    else onClosed()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void save(e.shiftKey)
    }
  }

  // ---------------------------------------------------------------- answer toolbar

  const words = useMemo(
    () => ({
      bold: t('editor.placeholder.bold'),
      italic: t('editor.placeholder.italic'),
      code: t('editor.placeholder.code'),
      item: t('editor.placeholder.item'),
      heading: t('editor.placeholder.heading'),
      link: t('editor.placeholder.link')
    }),
    [t]
  )

  const format = (action: MarkdownAction): void => {
    const area = answerArea.current
    if (!area) return
    setAnswer(applyMarkdown(area, action, words).slice(0, MAX_ANSWER))
  }

  const onAnswerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    const action = shortcutAction(e)
    if (!action) return
    e.preventDefault()
    e.stopPropagation()
    format(action)
  }

  const restoreDraft = (draft: CardDraftSnapshot): void => {
    if (tree.byId.has(draft.topicId)) setTopic(draft.topicId)
    setQuestion(draft.question)
    setAnswer(draft.answer)
    setTags(draft.tags)
    slots.reset(draft.images)
    setRestorable(null)
  }

  // ---------------------------------------------------------------- render

  const saveLabel = saving
    ? slots.uploading > 0
      ? t('editor.savingUploads', { count: slots.uploading })
      : t('editor.saving')
    : t('editor.save')
  const status = card?.status

  return (
    <div ref={root} className={`${dialog.root} ${dialog.content}`} onKeyDown={onKeyDown}>
      <header className={dialog.header}>
        <div className={dialog.headerStart}>
          {narrow && (
            <Button variant="ghost" iconOnly icon={<ArrowLeftIcon size={20} />} aria-label={t('cards.back')} onClick={requestClose} />
          )}
          {card ? (
            <>
              {!narrow && <span className={dialog.crumbs}>{topicPath(tree, topic)}</span>}
              {status && (
                <span className={dialog.badge} data-status={status}>
                  {t(`cards.status.${status}`)}
                </span>
              )}
            </>
          ) : (
            <h2 className={dialog.heading}>{t('editor.newTitle')}</h2>
          )}
        </div>

        <div className={dialog.actions}>
          {!narrow && <Button onClick={requestClose}>{t('common.cancel')}</Button>}
          <Button onClick={() => void save(true)} disabled={!question.trim() || saving} title={t('editor.saveAndNewHint')}>
            {t('editor.saveAndNew')}
          </Button>
          <Button variant="primary" onClick={() => void save(false)} disabled={!question.trim()} busy={saving} title={t('editor.saveHint')}>
            {saveLabel}
          </Button>
          {nav && !narrow && (
            <>
              <span className={dialog.divider} />
              <div className={dialog.nav}>
                <Button iconOnly icon={<ChevronLeftIcon size={18} />} aria-label={t('cards.previous')} onClick={() => guard(nav.prev)} disabled={nav.total < 2} />
                <span className={dialog.position}>{t('cards.position', { index: nav.index + 1, total: nav.total })}</span>
                <Button iconOnly icon={<ChevronRightIcon size={18} />} aria-label={t('cards.next')} onClick={() => guard(nav.next)} disabled={nav.total < 2} />
              </div>
            </>
          )}
          {!narrow && (
            <Button variant="ghost" iconOnly icon={<CloseIcon size={18} />} aria-label={t('common.close')} onClick={requestClose} />
          )}
        </div>
      </header>

      <div className={dialog.body}>
        <section className={`${dialog.main} ${styles.fields}`}>
          {restorable && (
            <div className={styles.draftBar} role="status">
              <span>{t('editor.draftFound')}</span>
              <div className={styles.draftActions}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    clearDraft(draftRef)
                    setRestorable(null)
                  }}
                >
                  {t('editor.discard')}
                </Button>
                <Button variant="primary" onClick={() => restoreDraft(restorable)}>
                  {t('editor.restore')}
                </Button>
              </div>
            </div>
          )}

          <div className={styles.field}>
            <span className={styles.label}>{t('editor.topic')}</span>
            <TopicPicker tree={tree} value={topic} onChange={setTopic} />
          </div>

          <label className={styles.field}>
            <span className={styles.label}>{t('editor.question')}</span>
            <input
              ref={questionInput}
              className={`${styles.question} ${questionError ? styles.invalid : ''}`}
              value={question}
              maxLength={MAX_QUESTION}
              placeholder={t('editor.questionPlaceholder')}
              aria-invalid={questionError || undefined}
              aria-describedby={questionError ? 'question-error' : undefined}
              data-autofocus
              onChange={(e) => {
                setQuestion(e.target.value)
                if (e.target.value.trim()) setQuestionError(false)
              }}
            />
            {questionError && (
              <span id="question-error" className={styles.error}>
                {t('editor.questionRequired')}
              </span>
            )}
          </label>

          <div className={styles.field}>
            <span className={styles.label} id="answer-label">
              {t('editor.answer')}
            </span>
            <div className={styles.answer}>
              <div className={styles.toolbar} role="toolbar" aria-labelledby="answer-label">
                {TOOLBAR.map(({ action, glyph, label }) => (
                  <button
                    key={action}
                    type="button"
                    className={`${styles.tool} ${action === 'bold' ? styles.toolBold : ''} ${action === 'italic' ? styles.toolItalic : ''}`}
                    aria-label={t(`editor.toolbar.${label}`)}
                    title={t(`editor.toolbar.${label}`)}
                    disabled={tab !== 'write'}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => format(action)}
                  >
                    {glyph}
                  </button>
                ))}
                <span className={styles.toolbarSpacer} />
                <div className={styles.tabs} role="tablist">
                  <button type="button" role="tab" aria-selected={tab === 'write'} className={styles.tab} onClick={() => setTab('write')}>
                    {t('editor.write')}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === 'preview'} className={styles.tab} onClick={() => setTab('preview')}>
                    {t('editor.preview')}
                  </button>
                </div>
              </div>
              {tab === 'write' ? (
                <textarea
                  ref={answerArea}
                  className={styles.textarea}
                  value={answer}
                  maxLength={MAX_ANSWER}
                  placeholder={t('editor.answerPlaceholder')}
                  aria-labelledby="answer-label"
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={onAnswerKeyDown}
                />
              ) : (
                <div className={styles.preview}>{answer.trim() ? <Markdown source={answer} /> : <p className={styles.nothing}>{t('editor.nothingToPreview')}</p>}</div>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>{t('editor.tags')}</span>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>
        </section>

        <aside className={dialog.side} aria-label={t('images.title')}>
          <Gallery
            slots={slots.slots}
            editable
            onBrowse={() => fileInput.current?.click()}
            onRemove={slots.remove}
            onRetry={slots.retry}
            onMove={slots.move}
            onOpen={setLightbox}
            flashErrors={flashErrors}
            footer={
              <>
                <span>{t('images.hint', { max: MAX_IMAGES })}</span>
                <Button variant="ghost" icon={<UploadIcon size={16} />} onClick={() => fileInput.current?.click()} disabled={slots.free === 0}>
                  {t('images.browse')}
                </Button>
              </>
            }
          />
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            multiple
            hidden
            onChange={(e) => {
              slots.addImages(filesOf(e.target.files))
              e.target.value = ''
            }}
          />
        </aside>
      </div>

      {drop.active &&
        (slots.free > 0 ? (
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

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t('editor.discardTitle')}
        width={420}
        footer={
          <>
            <Button onClick={() => setPending(null)} data-autofocus>
              {t('editor.keepEditing')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const then = pending
                setPending(null)
                then?.()
              }}
            >
              {t('editor.discard')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>{t('editor.discardBody')}</p>
      </Modal>
    </div>
  )
}
