import { useSyncExternalStore } from 'react'

export type LayoutMode = 'wide' | 'medium' | 'compact' | 'narrow'

/** Window-width breakpoints from the spec. Components size themselves with container queries. */
export function layoutModeFor(width: number): LayoutMode {
  if (width >= 1280) return 'wide'
  if (width >= 1024) return 'medium'
  if (width >= 720) return 'compact'
  return 'narrow'
}

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

const snapshot = (): LayoutMode => layoutModeFor(window.innerWidth)

/** Re-renders only when the mode changes, not on every pixel of a resize. */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, snapshot)
}

/**
 * Puts `.resizing` on <html> while the window is being resized and takes it off 150 ms after the
 * last resize event, so layout transitions do not stutter mid-drag.
 */
export function trackResizing(): void {
  let timer: number | undefined
  window.addEventListener('resize', () => {
    document.documentElement.classList.add('resizing')
    window.clearTimeout(timer)
    timer = window.setTimeout(() => document.documentElement.classList.remove('resizing'), 150)
  })
}
