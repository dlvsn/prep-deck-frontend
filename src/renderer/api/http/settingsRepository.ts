import type { HttpClient } from '../http'
import type { SettingsRepository } from '../repositories'
import type { Settings } from '../types'

/** prep-deck-backend `/api/settings`: the signed-in user's picks. */
export function createHttpSettingsRepository(http: HttpClient): SettingsRepository {
  return {
    get: () => http.get<Settings>('/settings'),
    update: (settings) => http.put<Settings>('/settings', settings)
  }
}
