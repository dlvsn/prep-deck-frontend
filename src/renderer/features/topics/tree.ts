import type { Id, Topic } from '@/api/types'

/** A topic with its children and the totals of its whole subtree. */
export interface TopicNode {
  topic: Topic
  children: TopicNode[]
  depth: number
  /** Cards in this topic and every subtopic below it. */
  totalCards: number
  /** Due cards in this topic and every subtopic below it. */
  totalDue: number
}

export interface TopicTree {
  roots: TopicNode[]
  byId: Map<Id, TopicNode>
}

/** Builds the tree from the flat list the API returns, siblings in their saved order. */
export function buildTree(topics: Topic[]): TopicTree {
  const byId = new Map<Id, TopicNode>()
  for (const topic of topics) {
    byId.set(topic.id, { topic, children: [], depth: 0, totalCards: 0, totalDue: 0 })
  }
  const roots: TopicNode[] = []
  for (const node of byId.values()) {
    const parent = node.topic.parentId ? byId.get(node.topic.parentId) : undefined
    // A parent outside the list (a shared subtree's root that is not ours) makes it a root here.
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const finish = (nodes: TopicNode[], depth: number): void => {
    nodes.sort((a, b) => a.topic.order - b.topic.order || a.topic.title.localeCompare(b.topic.title))
    for (const node of nodes) {
      node.depth = depth
      finish(node.children, depth + 1)
      node.totalCards = node.topic.cardCount + node.children.reduce((sum, c) => sum + c.totalCards, 0)
      node.totalDue = node.topic.dueCount + node.children.reduce((sum, c) => sum + c.totalDue, 0)
    }
  }
  finish(roots, 0)
  return { roots, byId }
}

/** Every topic id in the subtree, the topic itself included. */
export function subtreeIds(node: TopicNode): Set<Id> {
  const ids = new Set<Id>()
  const walk = (n: TopicNode): void => {
    ids.add(n.topic.id)
    n.children.forEach(walk)
  }
  walk(node)
  return ids
}

export function countSubtopics(node: TopicNode): number {
  return subtreeIds(node).size - 1
}

/** The chain from the root down to the topic, for breadcrumbs. */
export function pathTo(tree: TopicTree, id: Id): TopicNode[] {
  const path: TopicNode[] = []
  let node = tree.byId.get(id)
  while (node) {
    path.unshift(node)
    node = node.topic.parentId ? tree.byId.get(node.topic.parentId) : undefined
  }
  return path
}

/**
 * The rows a search leaves, top to bottom: every topic whose name contains the query (any case),
 * with its parents for context, whether or not they are expanded.
 */
export function matchingRows(tree: TopicTree, query: string): TopicNode[] {
  const needle = query.trim().toLowerCase()
  const keep = new Set<Id>()
  for (const node of tree.byId.values()) {
    if (node.topic.title.toLowerCase().includes(needle)) pathTo(tree, node.topic.id).forEach((n) => keep.add(n.topic.id))
  }
  const rows: TopicNode[] = []
  const walk = (nodes: TopicNode[]): void => {
    for (const node of nodes) {
      if (!keep.has(node.topic.id)) continue
      rows.push(node)
      walk(node.children)
    }
  }
  walk(tree.roots)
  return rows
}

/** The rows on screen, top to bottom: roots and the children of every expanded topic. */
export function visibleRows(tree: TopicTree, expanded: ReadonlySet<Id>): TopicNode[] {
  const rows: TopicNode[] = []
  const walk = (nodes: TopicNode[]): void => {
    for (const node of nodes) {
      rows.push(node)
      if (node.children.length && expanded.has(node.topic.id)) walk(node.children)
    }
  }
  walk(tree.roots)
  return rows
}

export type DropPosition = 'before' | 'inside' | 'after'

/**
 * Where a drop lands: the new parent and the position among its children, counted without the
 * dragged topic. Null when the drop would put a topic inside itself or its own subtree.
 */
export function dropTarget(
  tree: TopicTree,
  draggedId: Id,
  target: TopicNode,
  position: DropPosition
): { parentId: Id | null; order: number } | null {
  const dragged = tree.byId.get(draggedId)
  if (!dragged || subtreeIds(dragged).has(target.topic.id)) return null

  if (position === 'inside') {
    const order = target.children.filter((c) => c.topic.id !== draggedId).length
    return { parentId: target.topic.id, order }
  }
  const parentId = target.topic.parentId
  const siblings = (parentId ? tree.byId.get(parentId)?.children : tree.roots) ?? []
  const index = siblings.filter((s) => s.topic.id !== draggedId).findIndex((s) => s.topic.id === target.topic.id)
  return { parentId, order: position === 'before' ? index : index + 1 }
}
