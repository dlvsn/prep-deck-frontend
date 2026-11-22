import { ApiError, type HttpClient } from '../http'
import type { AuthRepository } from '../repositories'
import type { Registration, Session, User } from '../types'

/** Not on the backend yet: password reset needs an email sender first. */
const notAvailable = (): Promise<never> => Promise.reject(new ApiError('errors.notAvailable', 501))

/**
 * prep-deck-backend `/api/auth`. Calls that open or renew a session go without an access token
 * and without the refresh-on-401: there a 401 means a wrong password or a dead refresh token.
 */
export function createHttpAuthRepository(http: HttpClient): AuthRepository {
  const open = { auth: false } as const
  return {
    login: (login, password) => http.post<Session>('/auth/login', { login, password }, open),
    register: (email, username, password) =>
      http.post<Registration>('/auth/register', { email, username, password }, open),
    verifyEmail: (email, code) => http.post<Session>('/auth/verify-email', { email, code }, open),
    resendVerification: (email) => http.post<void>('/auth/resend-verification', { email }, open),
    refresh: (refreshToken) => http.post<Session>('/auth/refresh', { refreshToken }, open),
    logout: (refreshToken) => http.post<void>('/auth/logout', { refreshToken }, open),
    me: () => http.get<User>('/auth/me'),
    isUsernameFree: (username) =>
      http.get<boolean>(`/auth/username-available?username=${encodeURIComponent(username)}`, open),
    requestPasswordReset: notAvailable,
    verifyResetCode: notAvailable,
    resetPassword: notAvailable
  }
}
