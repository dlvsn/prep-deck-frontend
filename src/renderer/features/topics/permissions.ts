import type { Topic } from '@/api/types'

/**
 * What the UI offers on a topic, from the role the server returned for it (spec, «Шеринг»).
 * The server checks again; this only hides what would be refused.
 */
export const canEditContent = (t: Topic): boolean => t.role === 'owner' || t.role === 'editor'

/** Renaming a root and creating subtopics: owner or editor; a root's place is the owner's call. */
export const canRename = canEditContent
export const canCreateSubtopic = canEditContent

/** Moving or deleting: owner always; an editor only below the shared root. */
export const canMoveOrDelete = (t: Topic): boolean =>
  t.role === 'owner' || (t.role === 'editor' && t.parentId !== null)

export const canShare = (t: Topic): boolean => t.role === 'owner'
