import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import type { Id, TopicSharing } from '@/api/types'
import { topicKeys } from '@/features/topics/useTopics'
import { toastError } from '@/ui/toast'

export const sharingKey = (topicId: Id) => ['sharing', topicId] as const

/** Who can see the tree the topic belongs to. */
export function useSharing(topicId: Id) {
  return useQuery({ queryKey: sharingKey(topicId), queryFn: () => api.shares.get(topicId) })
}

/**
 * The owner's changes in the Share dialog. Each answers the tree's sharing as it stands after,
 * which replaces the cached one; My topics refetches too, for its "shared" marks. Failures show
 * a toast, except an invitation's, which the form shows under its field.
 */
export function useSharingMutations(topicId: Id) {
  const client = useQueryClient()
  const settle = (sharing: TopicSharing): void => {
    client.setQueryData(sharingKey(topicId), sharing)
    void client.invalidateQueries({ queryKey: topicKeys.mine })
  }

  const invite = useMutation({
    mutationFn: ({ login, topicIds }: { login: string; topicIds: Id[] }) => api.shares.invite(topicId, login, topicIds),
    onSuccess: settle
  })
  const revokeInvite = useMutation({
    mutationFn: (inviteId: Id) => api.shares.revokeInvite(topicId, inviteId),
    onSuccess: settle,
    onError: toastError
  })
  const changeTopics = useMutation({
    mutationFn: ({ userId, topicIds }: { userId: Id; topicIds: Id[] }) => api.shares.changeTopics(topicId, userId, topicIds),
    onSuccess: settle,
    onError: toastError
  })
  const removeMember = useMutation({
    mutationFn: (userId: Id) => api.shares.removeMember(topicId, userId),
    onSuccess: settle,
    onError: toastError
  })
  const setLink = useMutation({
    mutationFn: ({ enabled, topicIds }: { enabled: boolean; topicIds?: Id[] }) => api.shares.setLink(topicId, enabled, topicIds),
    onSuccess: settle,
    onError: toastError
  })
  const resetLink = useMutation({
    mutationFn: () => api.shares.resetLink(topicId),
    onSuccess: settle,
    onError: toastError
  })
  const removeLinkMembers = useMutation({
    mutationFn: () => api.shares.removeLinkMembers(topicId),
    onSuccess: settle,
    onError: toastError
  })

  return { invite, revokeInvite, changeTopics, removeMember, setLink, resetLink, removeLinkMembers }
}
