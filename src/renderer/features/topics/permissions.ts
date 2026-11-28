import type { Topic } from '@/api/types'

/**
 * What can be done on a topic. `edit` covers its content: renaming it, subtopics, and every card
 * action (new card, edit, images, drag and drop, duplicate, move a card, delete a card).
 * `move` and `delete` are about the topic itself; `share` is the owner's alone. `copy` and
 * `leave` belong to someone it was shared with: copy it into their own topics, give up the share.
 */
export type TopicAction = 'view' | 'edit' | 'move' | 'delete' | 'share' | 'copy' | 'leave'

/**
 * The single place the UI decides which actions to offer, from the role the server returned for
 * the topic (`owner` | `editor` | `viewer`). Nothing else in the code looks at roles or asks
 * "am I the owner"; the server checks again, this only hides what it would refuse.
 *
 * Only the owner changes a topic today, so shared topics arrive as `viewer`. `editor` is ready for
 * when it can be granted; it can be tried with VITE_FORCE_ROLE in development.
 */
export function can(action: TopicAction, topic: Topic): boolean {
  // In Shared with me a topic without a visible parent is where a share starts.
  const shareRoot = topic.parentId === null
  switch (topic.role) {
    case 'owner':
      return action !== 'copy' && action !== 'leave'
    case 'editor':
      // A shared root stays where its owner put it.
      if (action === 'move' || action === 'delete') return !shareRoot
      if (action === 'leave') return shareRoot
      return action === 'view' || action === 'edit' || action === 'copy'
    case 'viewer':
      if (action === 'leave') return shareRoot
      return action === 'view' || action === 'copy'
  }
}
