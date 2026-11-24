import type { Card } from '@/api/types'
import { pathTo, type TopicTree } from '@/features/topics/tree'

export const MAX_QUESTION = 500
export const MAX_ANSWER = 20_000

/** The answer as plain text for the preview on a grid card: Markdown marks and code blocks out. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?(```|$)/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "Java / JVM": where a topic sits, for breadcrumbs and toasts. */
export const topicPath = (tree: TopicTree, topicId: string): string =>
  pathTo(tree, topicId)
    .map((n) => n.topic.title)
    .join(' / ')

/** Due now or earlier; a new card is never due. */
export const isDue = (card: Card, now = Date.now()): boolean => card.dueAt !== null && Date.parse(card.dueAt) <= now

/** The copy's question, cut to fit the limit with the suffix kept. */
export function copyQuestion(question: string, format: (question: string) => string): string {
  const full = format(question)
  if (full.length <= MAX_QUESTION) return full
  const overflow = full.length - MAX_QUESTION
  return format(question.slice(0, Math.max(1, question.length - overflow - 1)) + '…')
}
