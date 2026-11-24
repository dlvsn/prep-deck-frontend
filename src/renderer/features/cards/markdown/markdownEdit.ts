/**
 * The answer toolbar's actions on a textarea. Each works on the selection, or inserts a template
 * with its placeholder selected when nothing is selected. Text goes in through
 * `document.execCommand('insertText')` where it works, so Ctrl+Z still undoes it.
 */
export type MarkdownAction = 'bold' | 'italic' | 'code' | 'bullets' | 'numbers' | 'heading' | 'link'

/** Placeholder words for empty selections, already in the user's language. */
export interface MarkdownPlaceholders {
  bold: string
  italic: string
  code: string
  item: string
  heading: string
  link: string
}

interface Edit {
  /** The range of the current value to replace. */
  from: number
  to: number
  text: string
  /** The selection afterwards, relative to `from`. */
  select: [number, number]
}

function wrap(value: string, start: number, end: number, marker: string, placeholder: string): Edit {
  const selected = value.slice(start, end)
  const inner = selected || placeholder
  return {
    from: start,
    to: end,
    text: `${marker}${inner}${marker}`,
    select: [marker.length, marker.length + inner.length]
  }
}

/** Widens the range to whole lines. */
function lineRange(value: string, start: number, end: number): [number, number] {
  const from = value.lastIndexOf('\n', start - 1) + 1
  const lineEnd = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  return [from, lineEnd === -1 ? value.length : lineEnd]
}

function prefixLines(value: string, start: number, end: number, prefix: (index: number) => string, placeholder: string): Edit {
  const [from, to] = lineRange(value, start, end)
  const lines = value.slice(from, to).split('\n')
  const empty = lines.length === 1 && lines[0].trim() === ''
  if (empty) {
    const head = prefix(0)
    return { from, to, text: `${head}${placeholder}`, select: [head.length, head.length + placeholder.length] }
  }
  const text = lines.map((line, i) => `${prefix(i)}${line.replace(/^(\s*)([-*+]|\d+\.|#{1,6})\s+/, '$1')}`).join('\n')
  return { from, to, text, select: [0, text.length] }
}

function codeBlock(value: string, start: number, end: number, placeholder: string): Edit {
  const selected = value.slice(start, end)
  const inner = selected || placeholder
  const before = start > 0 && value[start - 1] !== '\n' ? '\n' : ''
  const after = end < value.length && value[end] !== '\n' ? '\n' : ''
  const open = `${before}\`\`\`\n`
  return {
    from: start,
    to: end,
    text: `${open}${inner}\n\`\`\`${after}`,
    select: [open.length, open.length + inner.length]
  }
}

function link(value: string, start: number, end: number, placeholder: string): Edit {
  const label = value.slice(start, end) || placeholder
  const url = 'https://'
  const text = `[${label}](${url})`
  const urlStart = label.length + 3
  return { from: start, to: end, text, select: [urlStart, urlStart + url.length] }
}

function editFor(action: MarkdownAction, value: string, start: number, end: number, words: MarkdownPlaceholders): Edit {
  switch (action) {
    case 'bold':
      return wrap(value, start, end, '**', words.bold)
    case 'italic':
      return wrap(value, start, end, '_', words.italic)
    case 'code':
      return codeBlock(value, start, end, words.code)
    case 'bullets':
      return prefixLines(value, start, end, () => '- ', words.item)
    case 'numbers':
      return prefixLines(value, start, end, (i) => `${i + 1}. `, words.item)
    case 'heading':
      return prefixLines(value, start, end, () => '## ', words.heading)
    case 'link':
      return link(value, start, end, words.link)
  }
}

/**
 * Applies the action to the textarea in place and reports the new value, which the caller keeps
 * as its state (the change event may not fire for execCommand in every engine).
 */
export function applyMarkdown(area: HTMLTextAreaElement, action: MarkdownAction, words: MarkdownPlaceholders): string {
  const { value, selectionStart, selectionEnd } = area
  const edit = editFor(action, value, selectionStart, selectionEnd, words)
  area.focus()
  area.setSelectionRange(edit.from, edit.to)
  const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, edit.text)
  if (!inserted) area.setRangeText(edit.text, edit.from, edit.to, 'end')
  area.setSelectionRange(edit.from + edit.select[0], edit.from + edit.select[1])
  return area.value
}

/** The shortcut for an action, if any: Ctrl+B, Ctrl+I, Ctrl+K, Ctrl+Shift+C. */
export function shortcutAction(e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; key: string }): MarkdownAction | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  const key = e.key.toLowerCase()
  if (e.shiftKey) return key === 'c' ? 'code' : null
  if (key === 'b') return 'bold'
  if (key === 'i') return 'italic'
  if (key === 'k') return 'link'
  return null
}
