import { create } from 'zustand'
import type { Id } from '@/api/types'

/**
 * Which card dialog is open, so any entry point (the topic header, N, the tree's menu, a drop on
 * the grid) can open it. The dialog itself renders once, on the topics page.
 */
export type CardModalState =
  | { kind: 'closed' }
  | { kind: 'create'; topicId: Id; files: File[]; tags: string[]; session: number }
  | { kind: 'card'; topicId: Id; cardId: Id; mode: 'view' | 'edit' }

interface CardModalStore {
  state: CardModalState
  /** A fresh editor; `tags` carries over for Save & new. */
  openCreate(topicId: Id, files?: File[], tags?: string[]): void
  openCard(topicId: Id, cardId: Id, mode?: 'view' | 'edit'): void
  setMode(mode: 'view' | 'edit'): void
  close(): void
}

let session = 0

export const useCardModal = create<CardModalStore>()((set, get) => ({
  state: { kind: 'closed' },
  openCreate: (topicId, files = [], tags = []) =>
    set({ state: { kind: 'create', topicId, files, tags, session: ++session } }),
  openCard: (topicId, cardId, mode = 'view') => set({ state: { kind: 'card', topicId, cardId, mode } }),
  setMode: (mode) => {
    const { state } = get()
    if (state.kind === 'card') set({ state: { ...state, mode } })
  },
  close: () => set({ state: { kind: 'closed' } })
}))
