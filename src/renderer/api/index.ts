import { authBridge } from './authBridge'
import { createHttpClient } from './http'
import { createHttpAuthRepository } from './http/authRepository'
import { createHttpSettingsRepository } from './http/settingsRepository'
import { createMockRepositories } from './mocks'
import type { Repositories } from './repositories'

export const API_URL = import.meta.env.VITE_API_URL
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

/**
 * The repositories the whole app talks to.
 *
 * VITE_USE_MOCKS=true: every area is an in-memory mock, no backend needed.
 * VITE_USE_MOCKS=false: the areas the backend already serves go over HTTP; the rest stay mocks
 * until their endpoints exist. Today the backend serves `auth` and `settings`.
 */
function createRepositories(): Repositories {
  const mocks = createMockRepositories()
  if (USE_MOCKS) return mocks

  const http = createHttpClient({
    baseUrl: API_URL,
    getAccessToken: () => authBridge.getAccessToken(),
    refresh: () => authBridge.refresh(),
    onSessionExpired: () => authBridge.onSessionExpired()
  })
  const served: Partial<Repositories> = {
    auth: createHttpAuthRepository(http),
    settings: createHttpSettingsRepository(http)
  }

  const stillMocked = Object.keys(mocks).filter((area) => !(area in served))
  console.info(`[api] ${API_URL}: ${Object.keys(served).join(', ')}; still mocked: ${stillMocked.join(', ')}`)
  return { ...mocks, ...served }
}

export const api: Repositories = createRepositories()
