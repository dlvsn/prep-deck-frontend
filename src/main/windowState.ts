import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const MIN_WIDTH = 360
export const MIN_HEIGHT = 560

interface WindowState {
  bounds: Rectangle
  maximized: boolean
}

const file = (): string => join(app.getPath('userData'), 'window-state.json')

/** First launch: 1280 × 800, or 80 % of the screen when the screen is smaller than that. */
function defaultState(): WindowState {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.max(MIN_WIDTH, Math.min(1280, Math.round(area.width * 0.8)))
  const height = Math.max(MIN_HEIGHT, Math.min(800, Math.round(area.height * 0.8)))
  return {
    bounds: {
      x: area.x + Math.round((area.width - width) / 2),
      y: area.y + Math.round((area.height - height) / 2),
      width,
      height
    },
    maximized: false
  }
}

/** Whether enough of the window's title bar sits on some display to be grabbed. */
function visibleOnSomeDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapX = Math.min(bounds.x + bounds.width, a.x + a.width) - Math.max(bounds.x, a.x)
    const overlapY = Math.min(bounds.y + 40, a.y + a.height) - Math.max(bounds.y, a.y)
    return overlapX >= 100 && overlapY > 0
  })
}

/**
 * The saved size and position, or a centred default when there is none or the window would
 * open off every screen (a monitor that was unplugged since, say).
 */
export function loadWindowState(): WindowState {
  const fallback = defaultState()
  try {
    if (!existsSync(file())) return fallback
    const saved = JSON.parse(readFileSync(file(), 'utf-8')) as WindowState
    const b = saved.bounds
    if (![b?.x, b?.y, b?.width, b?.height].every(Number.isFinite)) return fallback
    const bounds = {
      ...b,
      width: Math.max(MIN_WIDTH, b.width),
      height: Math.max(MIN_HEIGHT, b.height)
    }
    if (!visibleOnSomeDisplay(bounds)) {
      const area = screen.getPrimaryDisplay().workArea
      bounds.width = Math.min(bounds.width, area.width)
      bounds.height = Math.min(bounds.height, area.height)
      bounds.x = area.x + Math.round((area.width - bounds.width) / 2)
      bounds.y = area.y + Math.round((area.height - bounds.height) / 2)
    }
    return { bounds, maximized: Boolean(saved.maximized) }
  } catch {
    return fallback
  }
}

/**
 * Saves the window's size and position as it changes. The normal bounds are kept while the
 * window is maximized, so un-maximizing after a restart returns to the size the user chose.
 */
export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | undefined

  const save = (): void => {
    if (win.isDestroyed()) return
    const state: WindowState = { bounds: win.getNormalBounds(), maximized: win.isMaximized() }
    try {
      writeFileSync(file(), JSON.stringify(state))
    } catch {
      // Losing the window position is not worth interrupting the user for.
    }
  }
  const saveSoon = (): void => {
    clearTimeout(timer)
    timer = setTimeout(save, 400)
  }

  win.on('resize', saveSoon)
  win.on('move', saveSoon)
  win.on('maximize', save)
  win.on('unmaximize', save)
  win.on('close', () => {
    clearTimeout(timer)
    save()
  })
}
