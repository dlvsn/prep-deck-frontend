import type { HttpClient } from '../http'
import type { CardsRepository } from '../repositories'
import type { Card } from '../types'

/** prep-deck-backend `/api/topics/{id}/cards` and `/api/cards`. */
export function createHttpCardsRepository(http: HttpClient): CardsRepository {
  return {
    list: (topicId) => http.get<Card[]>(`/topics/${topicId}/cards`),
    get: (id) => http.get<Card>(`/cards/${id}`),
    create: (topicId, draft) => http.post<Card>(`/topics/${topicId}/cards`, draft),
    update: (id, patch) => http.patch<Card>(`/cards/${id}`, patch),
    remove: (id) => http.delete<void>(`/cards/${id}`),
    duplicate: (id, question) => http.post<Card>(`/cards/${id}/duplicate`, { question }),
    tags: () => http.get<string[]>('/cards/tags')
  }
}
