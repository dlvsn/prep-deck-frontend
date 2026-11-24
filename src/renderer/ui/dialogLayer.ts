import { useCallback, useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Open dialogs, the topmost last. Only the top one answers Escape and keeps Tab inside itself. */
const stack: symbol[] = []

/**
 * Makes an element a dialog layer while `open`: focus moves into it (to `[data-autofocus]` or the
 * first focusable element) and returns to where it was on close; Escape calls `onEscape`; Tab
 * cycles inside. Layers stack, so a confirmation over the card modal takes the keys first.
 *
 * A widget inside that handles Escape itself while it is open (a suggestion list, a dropdown)
 * marks itself with `data-own-escape`; focus in a menu or popover outside the layer is left
 * alone too.
 *
 * Returns `isTop()`, for a layer's own shortcuts (arrows, E) to check that nothing is above it.
 */
export function useDialogLayer(open: boolean, ref: RefObject<HTMLElement | null>, onEscape: () => void): () => boolean {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape
  const id = useRef<symbol | null>(null)

  useEffect(() => {
    if (!open) return
    const me = Symbol('layer')
    id.current = me
    stack.push(me)
    const previous = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    const onKey = (e: KeyboardEvent): void => {
      if (stack[stack.length - 1] !== me || !node) return
      const active = document.activeElement
      if (active && active !== document.body && !node.contains(active)) return
      if ((e.target as Element | null)?.closest?.('[data-own-escape]')) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const [head, tail] = [items[0], items[items.length - 1]]
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      const index = stack.indexOf(me)
      if (index >= 0) stack.splice(index, 1)
      id.current = null
      if (previous?.isConnected) previous.focus()
    }
  }, [open, ref])

  return useCallback(() => id.current !== null && stack[stack.length - 1] === id.current, [])
}

/** True while the user is typing somewhere, when single-key shortcuts (N, E) must stay quiet. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
}

/** True while any dialog layer is open. */
export const anyLayerOpen = (): boolean => stack.length > 0
