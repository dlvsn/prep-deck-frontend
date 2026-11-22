import { api } from '@/api'
import type { Settings, SettingsInput } from '@/api/types'
import { useTopicsUi } from '@/features/topics/topicsUiStore'
import { isAccent } from '@/theme/accents'
import { useAppearance } from '@/theme/appearanceStore'
import { onSessionUser } from './session'

/**
 * Keeps the user's picks the same on every device: theme, accent, language, the topic opened last.
 *
 * - Signing in: the server's copy wins, since it is what the other devices saved. Nothing saved
 *   yet (a first sign-in): this device's values go up instead.
 * - Afterwards: every change is sent a second after the last one, as the whole set.
 * - The local copies (appearance store, topic tree store) stay the cache: the app starts with
 *   them at once and works offline; a failed send is retried by the next change.
 */

const PUSH_DELAY_MS = 1000

let syncedUserId: string | null = null
/** False until the first exchange with the server for this user is over: no sends before it. */
let ready = false
/** True while the server's values are being applied, so applying them does not send them back. */
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

type SavedSettings = Extract<Settings, { updatedAt: string }>

function localSettings(): SettingsInput {
  const { mode, accent, language } = useAppearance.getState()
  return { mode, accent, language, lastTopicId: useTopicsUi.getState().lastTopicId }
}

function apply(remote: SavedSettings): void {
  applying = true
  try {
    const current = useAppearance.getState()
    useAppearance.setState({
      mode: remote.mode,
      accent: isAccent(remote.accent) ? remote.accent : current.accent,
      language: remote.language
    })
    if (remote.lastTopicId) useTopicsUi.getState().setLastTopic(remote.lastTopicId)
  } finally {
    applying = false
  }
}

async function push(): Promise<void> {
  if (!syncedUserId) return
  try {
    await api.settings.update(localSettings())
  } catch {
    // Offline or the server is down: the next change sends the whole set again.
  }
}

function schedulePush(): void {
  if (!ready || applying || !syncedUserId) return
  clearTimeout(timer)
  timer = setTimeout(() => void push(), PUSH_DELAY_MS)
}

onSessionUser(async (user) => {
  const id = user?.id ?? null
  if (id === syncedUserId) return
  syncedUserId = id
  ready = false
  clearTimeout(timer)
  if (!id) return
  try {
    const remote = await api.settings.get()
    if (syncedUserId !== id) return
    if (remote.updatedAt !== null) apply(remote)
    else await push()
  } catch {
    // Unreachable: keep this device's values; changes go up once the server answers again.
  } finally {
    if (syncedUserId === id) ready = true
  }
})

useAppearance.subscribe((state, previous) => {
  if (state.mode !== previous.mode || state.accent !== previous.accent || state.language !== previous.language) {
    schedulePush()
  }
})

useTopicsUi.subscribe((state, previous) => {
  if (state.lastTopicId !== previous.lastTopicId) schedulePush()
})
