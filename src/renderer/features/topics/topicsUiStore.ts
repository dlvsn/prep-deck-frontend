import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Id } from '@/api/types'

interface TopicsUiState {
  /** Expanded topics in the tree; remembered across restarts. */
  expanded: Id[]
  /** The topic last opened in My topics, reopened on the next visit. */
  lastTopicId: Id | null
  toggle(id: Id): void
  expand(id: Id): void
  collapse(id: Id): void
  setLastTopic(id: Id | null): void
}

export const useTopicsUi = create<TopicsUiState>()(
  persist(
    (set, get) => ({
      // First launch: the two roots that are open on mockup 1.
      expanded: ['t-java', 't-english'],
      lastTopicId: 't-jvm',
      toggle: (id) => (get().expanded.includes(id) ? get().collapse(id) : get().expand(id)),
      expand: (id) => {
        if (!get().expanded.includes(id)) set({ expanded: [...get().expanded, id] })
      },
      collapse: (id) => set({ expanded: get().expanded.filter((e) => e !== id) }),
      setLastTopic: (id) => set({ lastTopicId: id })
    }),
    {
      name: 'prep-deck.topics-ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ expanded, lastTopicId }) => ({ expanded, lastTopicId })
    }
  )
)
