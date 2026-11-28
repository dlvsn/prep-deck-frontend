import type { HttpClient } from '../http'
import type { SharesRepository } from '../repositories'
import type { Topic, TopicSharing } from '../types'

/** prep-deck-backend `/api/topics/{id}/sharing` and `/api/shares`. */
export function createHttpSharesRepository(http: HttpClient): SharesRepository {
  const sharing = (topicId: string): string => `/topics/${topicId}/sharing`
  return {
    listShared: () => http.get<Topic[]>('/shares'),
    markSeen: (topicId) => http.post<void>(`/shares/${topicId}/seen`),
    get: (topicId) => http.get<TopicSharing>(sharing(topicId)),
    invite: (topicId, login, topicIds) => http.post<TopicSharing>(`${sharing(topicId)}/invites`, { login, topicIds }),
    revokeInvite: (topicId, inviteId) => http.delete<TopicSharing>(`${sharing(topicId)}/invites/${inviteId}`),
    changeTopics: (topicId, userId, topicIds) =>
      http.put<TopicSharing>(`${sharing(topicId)}/people/${userId}/topics`, { topicIds }),
    removeMember: (topicId, userId) => http.delete<TopicSharing>(`${sharing(topicId)}/people/${userId}`),
    setLink: (topicId, enabled, topicIds) => http.put<TopicSharing>(`${sharing(topicId)}/link`, { enabled, topicIds }),
    resetLink: (topicId) => http.post<TopicSharing>(`${sharing(topicId)}/link/reset`),
    removeLinkMembers: (topicId) => http.delete<TopicSharing>(`${sharing(topicId)}/link/people`),
    accept: (token) => http.post<Topic>('/shares/accept', { token }),
    leave: (topicId) => http.delete<void>(`/shares/${topicId}`),
    copyToMine: (topicId, parentId) => http.post<Topic>(`/shares/${topicId}/copy`, { parentId })
  }
}
