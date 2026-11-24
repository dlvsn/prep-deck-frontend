import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from '@/ui/icons'
import styles from './TagInput.module.css'

export const MAX_TAGS = 10
export const MAX_TAG_LENGTH = 40
const MAX_SUGGESTIONS = 6

/** How a tag is kept: lower case, without "#", trimmed. */
export const normalizeTag = (raw: string): string =>
  raw.trim().replace(/^#+/, '').trim().toLowerCase().slice(0, MAX_TAG_LENGTH)

/**
 * Tags as chips. Enter or a comma adds what is typed, Backspace in the empty field removes the
 * last chip. At most ten, no duplicates; while typing, the user's existing tags are suggested.
 */
export function TagInput({ value, onChange, suggestions }: { value: string[]; onChange(tags: string[]): void; suggestions: string[] }) {
  const { t } = useTranslation()
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [focused, setFocused] = useState(false)
  const full = value.length >= MAX_TAGS

  const matches = useMemo(() => {
    const needle = normalizeTag(text)
    if (!needle) return []
    return suggestions.filter((s) => s.includes(needle) && !value.includes(s)).slice(0, MAX_SUGGESTIONS)
  }, [text, suggestions, value])
  const open = focused && matches.length > 0

  /** Adds what is new among these, up to the limit, in one change. */
  const addAll = (raws: string[], rest = ''): void => {
    setText(rest)
    setActive(0)
    const next = [...value]
    for (const raw of raws) {
      const tag = normalizeTag(raw)
      if (tag && !next.includes(tag) && next.length < MAX_TAGS) next.push(tag)
    }
    if (next.length !== value.length) onChange(next)
  }
  const add = (raw: string): void => addAll([raw])

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === ',') {
      // Ctrl+Enter is Save; leave it to the editor.
      if (e.ctrlKey || e.metaKey) return
      e.preventDefault()
      add(open && e.key === 'Enter' ? matches[active] : text)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setText('')
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className={styles.field} onMouseDown={(e) => e.target === e.currentTarget && (e.preventDefault(), input.current?.focus())} data-own-escape={open || undefined}>
      {value.map((tag) => (
        <span key={tag} className={styles.chip}>
          #{tag}
          <button type="button" className={styles.chipRemove} onClick={() => onChange(value.filter((v) => v !== tag))} aria-label={t('editor.removeTag', { tag })}>
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <input
        ref={input}
        className={styles.input}
        value={text}
        disabled={full}
        maxLength={MAX_TAG_LENGTH + 1}
        placeholder={full ? t('editor.tagsFull', { max: MAX_TAGS }) : t('editor.tagPlaceholder')}
        aria-label={t('editor.tags')}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          const next = e.target.value
          if (next.includes(',')) {
            const parts = next.split(',')
            addAll(parts.slice(0, -1), parts[parts.length - 1])
          } else {
            setText(next)
            setActive(0)
          }
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          if (text.trim()) add(text)
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className={styles.suggestions}>
          {matches.map((tag, i) => (
            <li
              key={tag}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? styles.activeOption : undefined}
              onMouseDown={(e) => {
                e.preventDefault()
                add(tag)
              }}
              onMouseEnter={() => setActive(i)}
            >
              #{tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
