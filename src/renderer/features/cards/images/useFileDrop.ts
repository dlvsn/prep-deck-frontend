import { useEffect, useRef, useState, type RefObject } from 'react'
import { filesOf } from './imagePrep'

/**
 * Files dragged from the file manager over an element. Reacts only when the drag carries files
 * (text and links are ignored), and counts enter/leave so the overlay does not flicker while the
 * pointer crosses child elements. `onDrop` gets the dropped files; `active` drives the overlay.
 *
 * The window as a whole never opens a dropped file (see main.tsx and the main process), so a
 * drop outside every zone simply does nothing.
 */
export function useFileDrop(ref: RefObject<HTMLElement | null>, onDrop: (files: File[]) => void, enabled = true): { active: boolean } {
  const [active, setActive] = useState(false)
  const depth = useRef(0)
  const onDropRef = useRef(onDrop)
  onDropRef.current = onDrop

  useEffect(() => {
    const node = ref.current
    if (!node || !enabled) return
    const carriesFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false

    const onEnter = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      depth.current++
      setActive(true)
    }
    const onOver = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }
    const onDropEvent = (e: DragEvent): void => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      depth.current = 0
      setActive(false)
      onDropRef.current(filesOf(e.dataTransfer?.files))
    }
    // The drag may end anywhere (Escape, a drop outside the window); the overlay must not stay.
    const reset = (): void => {
      depth.current = 0
      setActive(false)
    }

    node.addEventListener('dragenter', onEnter)
    node.addEventListener('dragover', onOver)
    node.addEventListener('dragleave', onLeave)
    node.addEventListener('drop', onDropEvent)
    window.addEventListener('dragend', reset)
    window.addEventListener('drop', reset)
    return () => {
      node.removeEventListener('dragenter', onEnter)
      node.removeEventListener('dragover', onOver)
      node.removeEventListener('dragleave', onLeave)
      node.removeEventListener('drop', onDropEvent)
      window.removeEventListener('dragend', reset)
      window.removeEventListener('drop', reset)
      reset()
    }
  }, [ref, enabled])

  return { active }
}
