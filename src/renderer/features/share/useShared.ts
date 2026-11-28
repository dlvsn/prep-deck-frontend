import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import type { Id, Topic } from '@/api/types'
import { topicKeys } from '@/features/topics/useTopics'
import { toastError } from '@/ui/toast'

/** What someone a topic is shared with can do: come in by a link, mark it seen, leave, copy it. */
export function useSharedMutations() {
  const client = useQueryClient()

  const accept = useMutation({
    mutationFn: (token: string) => api.shares.accept(token),
    onSuccess: () => client.invalidateQueries({ queryKey: topicKeys.shared })
  })

  /** Clears the "new" mark at once; the server is told in the background. */
  const markSeen = useMutation({
    mutationFn: (topicId: Id) => api.shares.markSeen(topicId),
    onMutate: (topicId) => {
      const previous = client.getQueryData<Topic[]>(topicKeys.shared)
      if (previous) {
        client.setQueryData<Topic[]>(
          topicKeys.shared,
          previous.map((t) => (t.id === topicId ? { ...t, unseen: false } : t))
        )
      }
    }
  })

  const leave = useMutation({
    mutationFn: (topicId: Id) => api.shares.leave(topicId),
    onError: toastError,
    onSettled: () => client.invalidateQueries({ queryKey: topicKeys.shared })
  })

  const copyToMine = useMutation({
    mutationFn: ({ topicId, parentId }: { topicId: Id; parentId: Id | null }) => api.shares.copyToMine(topicId, parentId),
    onError: toastError,
    onSuccess: () => client.invalidateQueries({ queryKey: topicKeys.mine })
  })

  return { accept, markSeen, leave, copyToMine }
}
