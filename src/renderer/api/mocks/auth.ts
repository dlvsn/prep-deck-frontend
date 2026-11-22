import type { AuthRepository } from '../repositories'
import type { Registration, Session, User } from '../types'
import { newId, users } from './db'

/**
 * Accounts of mock mode, behaving like the backend: sign-up leaves the account unconfirmed until
 * the emailed code comes back. The demo account owns all the seeded topics; any account
 * registered here lives until the window reloads and sees the same demo data.
 */
export const DEMO_LOGIN = 'denys'
export const DEMO_PASSWORD = 'prepdeck1'
/** The code every mock letter "contains": confirmation and password reset alike. */
export const DEMO_CODE = '123456'

const CODE_TTL_MINUTES = 15
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_S = 60

interface Account {
  user: User
  password: string
  verified: boolean
}

interface PendingCode {
  attemptsLeft: number
  expiresAt: number
  sentAt: number
}

const accounts = new Map<string, Account>([[users.me.id, { user: users.me, password: DEMO_PASSWORD, verified: true }]])
for (const u of [users.andrii, users.olena, users.taras]) {
  accounts.set(u.id, { user: u, password: newId('locked'), verified: true })
}
const codes = new Map<string, PendingCode>()

const find = (login: string): Account | undefined => {
  const needle = login.trim().toLowerCase()
  return [...accounts.values()].find((a) => a.user.email === needle || a.user.username === needle)
}

let current: User | null = null
const resetTokens = new Map<string, string>()

/**
 * The refresh token carries the user id, so a session survives a reload of the window even
 * though everything else in mock mode starts over.
 */
function session(user: User): Session {
  current = user
  return { accessToken: newId('access'), refreshToken: `refresh.${user.id}.${newId('r')}`, user }
}

const secondsUntilResend = (userId: string): number => {
  const sent = codes.get(userId)?.sentAt ?? 0
  return Math.max(0, Math.ceil((sent + RESEND_COOLDOWN_S * 1000 - Date.now()) / 1000))
}

/** "Sends" a letter: a fresh code, unless the last one went out inside the cooldown. */
function sendCode(userId: string): void {
  if (secondsUntilResend(userId) > 0) return
  const now = Date.now()
  codes.set(userId, { attemptsLeft: MAX_ATTEMPTS, expiresAt: now + CODE_TTL_MINUTES * 60_000, sentAt: now })
}

type Respond = <T>(produce: () => T) => Promise<T>
type Fail = (message: string, status?: number, data?: unknown) => never

export function createMockAuth(respond: Respond, fail: Fail): AuthRepository {
  return {
    login: (login, password) =>
      respond(() => {
        const account = find(login)
        if (!account || account.password !== password) return fail('auth.invalidCredentials', 401)
        if (!account.verified) {
          sendCode(account.user.id)
          return fail('auth.emailNotVerified', 403, {
            email: account.user.email,
            resendAfterSeconds: secondsUntilResend(account.user.id)
          })
        }
        return session(account.user)
      }),

    register: (email, username, password) =>
      respond((): Registration => {
        const mail = email.trim().toLowerCase()
        const name = username.trim().toLowerCase()
        let account = find(mail)
        if (account?.verified) return fail('auth.emailTaken', 409)
        const holder = find(name)
        if (holder && holder !== account) return fail('auth.usernameTaken', 409)
        if (password.length < 8) return fail('auth.passwordRules')
        if (!account) {
          account = { user: { id: newId('u'), email: mail, username: name, name: username.trim() }, password, verified: false }
          accounts.set(account.user.id, account)
        }
        account.user = { ...account.user, username: name, name: username.trim() }
        account.password = password
        sendCode(account.user.id)
        return { email: mail, codeTtlMinutes: CODE_TTL_MINUTES, resendAfterSeconds: secondsUntilResend(account.user.id) }
      }),

    verifyEmail: (email, code) =>
      respond(() => {
        const account = find(email)
        if (!account) return fail('auth.codeExpired')
        if (account.verified) return fail('auth.emailAlreadyVerified', 409)
        const pending = codes.get(account.user.id)
        if (!pending || pending.attemptsLeft <= 0 || pending.expiresAt < Date.now()) return fail('auth.codeExpired')
        if (code !== DEMO_CODE) {
          pending.attemptsLeft--
          if (pending.attemptsLeft <= 0) return fail('auth.codeAttemptsExhausted')
          return fail('auth.codeInvalid', 400, { attemptsLeft: pending.attemptsLeft })
        }
        codes.delete(account.user.id)
        account.verified = true
        return session(account.user)
      }),

    resendVerification: (email) =>
      respond(() => {
        const account = find(email)
        if (!account || account.verified) return
        const wait = secondsUntilResend(account.user.id)
        if (wait > 0) return fail('auth.resendTooSoon', 429, { retryAfterSeconds: wait })
        sendCode(account.user.id)
      }),

    refresh: (refreshToken) =>
      respond(() => {
        const userId = refreshToken.split('.')[1]
        const account = userId ? accounts.get(userId) : undefined
        if (!account) return fail('errors.sessionExpired', 401)
        return session(account.user)
      }),

    logout: () =>
      respond(() => {
        current = null
      }),

    me: () => respond(() => current ?? fail('errors.sessionExpired', 401)),

    isUsernameFree: (username) => respond(() => !find(username)),

    requestPasswordReset: () => respond(() => undefined),

    verifyResetCode: (email, code) =>
      respond(() => {
        if (code !== DEMO_CODE) return fail('auth.codeInvalid')
        const token = newId('reset')
        resetTokens.set(token, email.trim().toLowerCase())
        return token
      }),

    resetPassword: (resetToken, password) =>
      respond(() => {
        const email = resetTokens.get(resetToken) ?? fail('auth.codeInvalid')
        resetTokens.delete(resetToken)
        const account = find(email)
        if (account) account.password = password
      })
  }
}
