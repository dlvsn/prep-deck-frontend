import type { HttpClient } from '../http'
import type { TopicsRepository } from '../repositories'
import type { Role, Topic } from '../types'

/**
 * Development only: VITE_FORCE_ROLE=viewer (or editor) makes every topic arrive with that role,
 * so the read-only and editor states can be checked against a backend that, without sharing,
 * only ever answers owner. Ignored in a packaged build.
 */
const forcedRole: Role | null = (() => {
  const value = import.meta.env.DEV ? import.meta.env.VITE_FORCE_ROLE : undefined
  return value === 'owner' || value === 'editor' || value === 'viewer' ? value : null
})()

const withRole = (topic: Topic): Topic => (forcedRole ? { ...topic, role: forcedRole } : topic)

/** prep-deck-backend `/api/topics`: the signed-in user's topic tree. */
export function createHttpTopicsRepository(http: HttpClient): TopicsRepository {
  return {
    listMine: async () => (await http.get<Topic[]>('/topics')).map(withRole),
    create: async (title, parentId) => withRole(await http.post<Topic>('/topics', { title, parentId })),
    rename: async (id, title) => withRole(await http.patch<Topic>(`/topics/${id}`, { title })),
    move: async (id, parentId, order) => withRole(await http.post<Topic>(`/topics/${id}/move`, { parentId, order })),
    remove: (id) => http.delete<void>(`/topics/${id}`)
  }
}
