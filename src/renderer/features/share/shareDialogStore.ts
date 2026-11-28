import { create } from 'zustand'
import type { Id } from '@/api/types'

interface ShareDialogState {
  /** The topic the dialog was opened on; its tree is what gets shared. Null: closed. */
  topicId: Id | null
  open(topicId: Id): void
  close(): void
}

/** Who opens the Share dialog: the topic header and the tree's menu alike. */
export const useShareDialog = create<ShareDialogState>()((set) => ({
  topicId: null,
  open: (topicId) => set({ topicId }),
  close: () => set({ topicId: null })
}))
