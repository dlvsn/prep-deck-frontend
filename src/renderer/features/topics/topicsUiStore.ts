import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Id } from '@/api/types'
import { onSessionUser } from '@/app/session'

interface TopicsUiState {
  /** Expanded topics in the tree; remembered across restarts. */
  expanded: Id[]
  /** The topic last opened in My topics, reopened on the next visit. */
  lastTopicId: Id | null
  /** The same for Shared with me. */
  lastSharedTopicId: Id | null
  toggle(id: Id): void
  expand(id: Id): void
  collapse(id: Id): void
  setLastTopic(id: Id | null): void
  setLastSharedTopic(id: Id | null): void
}

const KEY = 'prep-deck.topics-ui'

// First launch: nothing expanded, no topic remembered; the page opens the first root.
const initial = (): Pick<TopicsUiState, 'expanded' | 'lastTopicId' | 'lastSharedTopicId'> => ({
  expanded: [],
  lastTopicId: null,
  lastSharedTopicId: null
})

/** Whose tree state is being read and written; null between sessions, when nothing is saved. */
let userId: string | null = null

const keyOf = (name: string, id: string): string => `${name}.${id}`

/**
 * localStorage, one entry per user (`prep-deck.topics-ui.<user id>`), so two people sharing a
 * computer each find their own last topic and open branches. Nobody signed in: nothing is read
 * or written.
 */
const perUserStorage: StateStorage = {
  getItem: (name) => {
    try {
      return userId ? localStorage.getItem(keyOf(name, userId)) : null
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      if (userId) localStorage.setItem(keyOf(name, userId), value)
    } catch {
      // Storage full or blocked: the tree state is a convenience, not worth an error.
    }
  },
  removeItem: (name) => {
    try {
      if (userId) localStorage.removeItem(keyOf(name, userId))
    } catch {
      // As above.
    }
  }
}

export const useTopicsUi = create<TopicsUiState>()(
  persist(
    (set, get) => ({
      ...initial(),
      toggle: (id) => (get().expanded.includes(id) ? get().collapse(id) : get().expand(id)),
      expand: (id) => {
        if (!get().expanded.includes(id)) set({ expanded: [...get().expanded, id] })
      },
      collapse: (id) => set({ expanded: get().expanded.filter((e) => e !== id) }),
      setLastTopic: (id) => set({ lastTopicId: id }),
      setLastSharedTopic: (id) => set({ lastSharedTopicId: id })
    }),
    {
      name: KEY,
      version: 1,
      storage: createJSONStorage(() => perUserStorage),
      partialize: ({ expanded, lastTopicId, lastSharedTopicId }) => ({ expanded, lastTopicId, lastSharedTopicId }),
      // Read only once we know whose state it is.
      skipHydration: true
    }
  )
)

/**
 * Switches the tree state to this user's (or to none). The in-memory state is reset with saving
 * switched off, so one user's tree never lands in another's entry.
 */
function bindToUser(id: string | null): void {
  if (id === userId) return
  userId = null
  useTopicsUi.setState(initial())
  userId = id
  if (!id) return
  adoptSharedEntry(id)
  void useTopicsUi.persist.rehydrate()
}

/**
 * Before entries were per user there was one shared entry. The first person to sign in afterwards
 * takes it over, so an existing install keeps its last topic.
 */
function adoptSharedEntry(id: string): void {
  try {
    const shared = localStorage.getItem(KEY)
    if (shared === null) return
    if (localStorage.getItem(keyOf(KEY, id)) === null) localStorage.setItem(keyOf(KEY, id), shared)
    localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: start from the defaults.
  }
}

onSessionUser((user) => bindToUser(user?.id ?? null))
