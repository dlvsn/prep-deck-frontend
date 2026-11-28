import type { Id } from '@/api/types'
import { pathTo, type TopicNode, type TopicTree } from '@/features/topics/tree'

/**
 * A choice of topics to share, as the server keeps it: the outermost topics only. A topic brings
 * its whole subtree, subtopics added later included; a subtopic of a chosen topic is never listed.
 */
export type Scope = Id[]

/** The chosen topic at or above this one, if any. */
function coveringId(tree: TopicTree, scope: Scope, id: Id): Id | undefined {
  return pathTo(tree, id).find((n) => scope.includes(n.topic.id))?.topic.id
}

export function isCovered(tree: TopicTree, scope: Scope, id: Id): boolean {
  return coveringId(tree, scope, id) !== undefined
}

/** Not covered itself, but something below it is: shown half-ticked. */
export function isMixed(tree: TopicTree, scope: Scope, node: TopicNode): boolean {
  if (isCovered(tree, scope, node.topic.id)) return false
  return scope.some((id) => id !== node.topic.id && pathTo(tree, id).some((n) => n.topic.id === node.topic.id))
}

/**
 * Ticks or unticks a topic. Unticking one that a chosen parent covers keeps the rest of that
 * parent: the parent gives way to its other children, level by level down to this topic.
 */
export function toggle(tree: TopicTree, scope: Scope, node: TopicNode): Scope {
  const id = node.topic.id
  const cover = coveringId(tree, scope, id)
  if (cover === undefined) {
    const below = new Set<Id>()
    const walk = (n: TopicNode): void => {
      below.add(n.topic.id)
      n.children.forEach(walk)
    }
    walk(node)
    return [...scope.filter((s) => !below.has(s)), id]
  }
  if (cover === id) return scope.filter((s) => s !== id)

  const next = scope.filter((s) => s !== cover)
  const path = pathTo(tree, id)
  const from = path.findIndex((n) => n.topic.id === cover)
  for (let i = from; i < path.length - 1; i++) {
    const onPath = path[i + 1].topic.id
    path[i].children.forEach((child) => {
      if (child.topic.id !== onPath) next.push(child.topic.id)
    })
  }
  return next
}

/** The chosen topics in tree order, the ones the tree no longer has left out. */
export function ordered(tree: TopicTree, scope: Scope): TopicNode[] {
  const order: TopicNode[] = []
  const walk = (nodes: TopicNode[]): void => {
    for (const n of nodes) {
      if (scope.includes(n.topic.id)) order.push(n)
      walk(n.children)
    }
  }
  walk(tree.roots)
  return order
}

/** Cards in every chosen topic and below. */
export function scopeCards(tree: TopicTree, scope: Scope): number {
  return ordered(tree, scope).reduce((sum, n) => sum + n.totalCards, 0)
}

export function sameScope(a: Scope, b: Scope): boolean {
  return a.length === b.length && a.every((id) => b.includes(id))
}
