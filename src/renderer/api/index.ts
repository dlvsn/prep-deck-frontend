import { createMockRepositories } from './mocks'
import type { Repositories } from './repositories'

export const API_URL = import.meta.env.VITE_API_URL
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

/**
 * The repositories the whole app talks to. With VITE_USE_MOCKS=true (the default) they are
 * in-memory mocks; HTTP implementations over api/http.ts are added area by area as the backend
 * grows its endpoints.
 */
function createRepositories(): Repositories {
  if (USE_MOCKS) return createMockRepositories()
  throw new Error('No HTTP repositories yet: set VITE_USE_MOCKS=true until the backend exposes them.')
}

export const api: Repositories = createRepositories()
