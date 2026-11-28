import { authBridge } from './authBridge'
import { createHttpClient } from './http'
import { createHttpAuthRepository } from './http/authRepository'
import { createHttpCardsRepository } from './http/cardsRepository'
import { createHttpImagesRepository } from './http/imagesRepository'
import { createHttpSettingsRepository } from './http/settingsRepository'
import { createHttpSharesRepository } from './http/sharesRepository'
import { createHttpTopicsRepository } from './http/topicsRepository'
import type { Repositories } from './repositories'

export const API_URL = import.meta.env.VITE_API_URL

/** The repositories the whole app talks to, all over HTTP to prep-deck-backend at VITE_API_URL. */
function createRepositories(): Repositories {
  const http = createHttpClient({
    baseUrl: API_URL,
    getAccessToken: () => authBridge.getAccessToken(),
    refresh: () => authBridge.refresh(),
    onSessionExpired: () => authBridge.onSessionExpired()
  })
  return {
    auth: createHttpAuthRepository(http),
    topics: createHttpTopicsRepository(http),
    cards: createHttpCardsRepository(http),
    images: createHttpImagesRepository(http),
    shares: createHttpSharesRepository(http),
    settings: createHttpSettingsRepository(http)
  }
}

export const api: Repositories = createRepositories()
