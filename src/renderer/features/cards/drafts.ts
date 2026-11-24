import type { CardImage, Id } from '@/api/types'

/**
 * Unsaved editor content, kept in localStorage while the editor is open so a crash or a closed
 * window loses nothing. One entry per user and per card (or per topic for a new card).
 */
export interface DraftRef {
  userId: Id
  /** `card:<id>` for an edit, `new:<topic id>` for a new card. */
  target: string
}

export interface CardDraftSnapshot {
  topicId: Id
  question: string
  answer: string
  tags: string[]
  /** Uploaded pictures only; the server drops unused uploads after 24 h. */
  images: CardImage[]
  savedAt: number
}

/** Uploads older than this may already be gone from the server; such a draft keeps its text only. */
const IMAGES_KEPT_MS = 23 * 60 * 60 * 1000

export const draftTarget = (cardId: Id | null, topicId: Id): string => (cardId ? `card:${cardId}` : `new:${topicId}`)

const keyOf = ({ userId, target }: DraftRef): string => `prep-deck.draft.${userId}.${target}`

export function readDraft(ref: DraftRef): CardDraftSnapshot | null {
  try {
    const raw = localStorage.getItem(keyOf(ref))
    if (!raw) return null
    const draft = JSON.parse(raw) as CardDraftSnapshot
    if (typeof draft.question !== 'string' || typeof draft.answer !== 'string' || !Array.isArray(draft.tags)) return null
    if (!Array.isArray(draft.images) || Date.now() - draft.savedAt > IMAGES_KEPT_MS) draft.images = []
    return draft
  } catch {
    return null
  }
}

export function writeDraft(ref: DraftRef, draft: CardDraftSnapshot): void {
  try {
    localStorage.setItem(keyOf(ref), JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the draft is a safety net, not worth an error.
  }
}

export function clearDraft(ref: DraftRef): void {
  try {
    localStorage.removeItem(keyOf(ref))
  } catch {
    // As above.
  }
}
