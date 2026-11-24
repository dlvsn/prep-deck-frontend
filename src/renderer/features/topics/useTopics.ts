import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/api'
import type { Id, Topic } from '@/api/types'
import { toastError } from '@/ui/toast'
import { buildTree, type TopicTree } from './tree'

export const topicKeys = {
  mine: ['topics', 'mine'] as const
}

export function useMyTopics(): { tree: TopicTree | null; isLoading: boolean; isError: boolean } {
  const query = useQuery({ queryKey: topicKeys.mine, queryFn: () => api.topics.listMine() })
  const tree = useMemo(() => (query.data ? buildTree(query.data) : null), [query.data])
  return { tree, isLoading: query.isLoading, isError: query.isError }
}

/** Replaces one topic in the cached list right away, so the tree does not wait for the server. */
function patchCached(client: QueryClient, id: Id, patch: Partial<Topic>): Topic[] | undefined {
  const previous = client.getQueryData<Topic[]>(topicKeys.mine)
  if (previous) {
    client.setQueryData<Topic[]>(
      topicKeys.mine,
      previous.map((t) => (t.id === id ? { ...t, ...patch } : t))
    )
  }
  return previous
}

/**
 * Every change to My topics. Rename and move apply optimistically and roll back with a toast if
 * the server refuses; create and delete wait for it, then refetch.
 */
export function useTopicMutations() {
  const client = useQueryClient()
  const refetch = () => client.invalidateQueries({ queryKey: ['topics'] })

  const create = useMutation({
    mutationFn: ({ title, parentId }: { title: string; parentId: Id | null }) => api.topics.create(title, parentId),
    onError: toastError,
    onSettled: refetch
  })

  const rename = useMutation({
    mutationFn: ({ id, title }: { id: Id; title: string }) => api.topics.rename(id, title),
    onMutate: ({ id, title }) => ({ previous: patchCached(client, id, { title }) }),
    onError: (error, _vars, context) => {
      if (context?.previous) client.setQueryData(topicKeys.mine, context.previous)
      toastError(error)
    },
    onSettled: refetch
  })

  const move = useMutation({
    mutationFn: ({ id, parentId, order }: { id: Id; parentId: Id | null; order: number }) =>
      api.topics.move(id, parentId, order),
    onMutate: ({ id, parentId, order }) => {
      const previous = client.getQueryData<Topic[]>(topicKeys.mine)
      if (previous) {
        // Re-number the new siblings the way the server will, so the row lands in place at once.
        const moved = previous.find((t) => t.id === id)
        const siblings = previous
          .filter((t) => t.parentId === parentId && t.id !== id)
          .sort((a, b) => a.order - b.order)
        if (moved) siblings.splice(order, 0, moved)
        const orders = new Map(siblings.map((t, i) => [t.id, i]))
        client.setQueryData<Topic[]>(
          topicKeys.mine,
          previous.map((t) =>
            t.id === id ? { ...t, parentId, order: orders.get(id)! } : orders.has(t.id) ? { ...t, order: orders.get(t.id)! } : t
          )
        )
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) client.setQueryData(topicKeys.mine, context.previous)
      toastError(error)
    },
    onSettled: refetch
  })

  const remove = useMutation({
    mutationFn: (id: Id) => api.topics.remove(id),
    onError: toastError,
    onSettled: () => {
      void refetch()
      // The cards of a deleted subtree are gone too.
      void client.invalidateQueries({ queryKey: ['cards'] })
    }
  })

  return { create, rename, move, remove }
}
