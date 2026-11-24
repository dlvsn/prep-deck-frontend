import type { Topic } from '@/api/types'

/**
 * What can be done on a topic. `edit` covers its content: renaming it, subtopics, and every card
 * action (new card, edit, images, drag and drop, duplicate, move a card, delete a card).
 * `move` and `delete` are about the topic itself; `share` is the owner's alone.
 */
export type TopicAction = 'view' | 'edit' | 'move' | 'delete' | 'share'

/**
 * The single place the UI decides which actions to offer, from the role the server returned for
 * the topic (`owner` | `editor` | `viewer`). Nothing else in the code looks at roles or asks
 * "am I the owner"; the server checks again, this only hides what it would refuse.
 *
 * Sharing is not built yet, so the server answers `owner` everywhere; editor and viewer can be
 * tried with VITE_FORCE_ROLE in development.
 */
export function can(action: TopicAction, topic: Topic): boolean {
  switch (topic.role) {
    case 'owner':
      return true
    case 'editor':
      // A shared root stays where its owner put it.
      if (action === 'move' || action === 'delete') return topic.parentId !== null
      return action === 'view' || action === 'edit'
    case 'viewer':
      return action === 'view'
  }
}
