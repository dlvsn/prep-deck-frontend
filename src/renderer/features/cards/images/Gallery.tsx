import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, ExpandIcon, PlusIcon, RetryIcon } from '@/ui/icons'
import styles from './Gallery.module.css'
import { MAX_IMAGES } from './imagePrep'
import type { ImageSlot } from './useImageSlots'

interface GalleryProps {
  slots: ImageSlot[]
  /** Editing: the empty "+" slot, × on every picture, drag to reorder. */
  editable: boolean
  /** Opens the file picker (the "+" slot). */
  onBrowse?(): void
  /** × on a slot. Outside editing it is offered only on slots still uploading or failed. */
  onRemove?(key: string): void
  onRetry?(key: string): void
  onMove?(from: number, to: number): void
  /** Full-window view of the picture at this index. */
  onOpen(index: number): void
  /** Briefly marks failed slots (Save was pressed with a failed upload). */
  flashErrors?: boolean
  /** Under the thumbnails: a count, or the editor's hint and Browse button. */
  footer?: ReactNode
}

/**
 * The picture panel of a card (mockups 2 and 3): the selected picture large, with arrows, a
 * counter and ⤢, then five slots below. Slots show upload progress on top of the local preview,
 * a red frame with ↻ when the upload failed, and reorder by dragging while editing.
 */
export function Gallery({ slots, editable, onBrowse, onRemove, onRetry, onMove, onOpen, flashErrors, footer }: GalleryProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, Math.max(0, slots.length - 1))
  const current = slots[index]

  // A newly added picture becomes the selected one.
  const [count, setCount] = useState(slots.length)
  useEffect(() => {
    if (slots.length > count) setSelected(slots.length - 1)
    setCount(slots.length)
  }, [slots.length, count])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    const from = slots.findIndex((s) => s.key === active.id)
    const to = slots.findIndex((s) => s.key === over.id)
    if (from < 0 || to < 0) return
    onMove?.(from, to)
    if (selected === from) setSelected(to)
  }

  const step = (delta: number): void => setSelected((index + delta + slots.length) % slots.length)
  const empties = Math.max(0, MAX_IMAGES - slots.length)

  return (
    <div className={styles.gallery}>
      <div className={styles.stage}>
        {current ? (
          <>
            <button type="button" className={styles.stageImage} onClick={() => onOpen(index)} aria-label={t('images.open')}>
              <img key={current.preview} src={current.preview} alt="" draggable={false} />
            </button>
            {slots.length > 1 && (
              <>
                <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={() => step(-1)} aria-label={t('images.previous')}>
                  <ChevronLeftIcon size={18} />
                </button>
                <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={() => step(1)} aria-label={t('images.next')}>
                  <ChevronRightIcon size={18} />
                </button>
              </>
            )}
            <button type="button" className={styles.expand} onClick={() => onOpen(index)} aria-label={t('images.open')} title={t('images.open')}>
              <ExpandIcon size={16} />
            </button>
            <span className={styles.counter}>{t('images.counter', { index: index + 1, total: slots.length })}</span>
          </>
        ) : (
          <p className={styles.stageEmpty}>{editable ? t('images.dropHere') : t('images.empty')}</p>
        )}
      </div>

      <div className={styles.thumbs}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={slots.map((s) => s.key)} strategy={horizontalListSortingStrategy}>
            {slots.map((slot, i) => (
              <Thumb
                key={slot.key}
                slot={slot}
                position={i + 1}
                selected={i === index}
                sortable={editable && slots.length > 1}
                removable={editable || slot.status !== 'done'}
                flash={flashErrors === true && slot.status === 'error'}
                onSelect={() => setSelected(i)}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))}
          </SortableContext>
        </DndContext>
        {Array.from({ length: empties }, (_, i) =>
          editable && i === 0 && onBrowse ? (
            <button key="add" type="button" className={`${styles.slot} ${styles.add}`} onClick={onBrowse} aria-label={t('images.add')} title={t('images.add')}>
              <PlusIcon size={20} />
            </button>
          ) : (
            <span key={`empty-${i}`} className={`${styles.slot} ${styles.empty}`} aria-hidden="true" />
          )
        )}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}

interface ThumbProps {
  slot: ImageSlot
  position: number
  selected: boolean
  sortable: boolean
  removable: boolean
  flash: boolean
  onSelect(): void
  onRemove?(key: string): void
  onRetry?(key: string): void
}

function Thumb({ slot, position, selected, sortable, removable, flash, onSelect, onRemove, onRetry }: ThumbProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.key, disabled: !sortable })
  const classes = [
    styles.slot,
    styles.thumb,
    selected ? styles.selected : '',
    slot.status === 'error' ? styles.error : '',
    flash ? styles.flash : '',
    isDragging ? styles.dragging : ''
  ].join(' ')

  return (
    <div
      ref={setNodeRef}
      className={classes}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={t('images.slot', { index: position })}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === 'Enter') onSelect()
        if ((e.key === 'Delete' || e.key === 'Backspace') && removable) onRemove?.(slot.key)
      }}
    >
      <img src={slot.preview} alt="" draggable={false} />

      {slot.status === 'uploading' && (
        <span className={styles.progress} role="progressbar" aria-label={t('images.uploading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(slot.progress * 100)}>
          <span style={{ transform: `scaleX(${Math.max(0.04, slot.progress)})` }} />
        </span>
      )}

      {slot.status === 'error' && onRetry && (
        <button
          type="button"
          className={styles.retry}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRetry(slot.key)
          }}
          aria-label={t('images.retry')}
          title={t('images.failed')}
        >
          <RetryIcon size={16} />
        </button>
      )}

      {removable && onRemove && (
        <button
          type="button"
          className={styles.remove}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(slot.key)
          }}
          aria-label={t('images.remove')}
          title={t('images.remove')}
        >
          <CloseIcon size={12} />
        </button>
      )}
    </div>
  )
}
