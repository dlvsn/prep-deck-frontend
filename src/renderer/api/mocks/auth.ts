import type { AuthRepository } from '../repositories'
import type { Session, User } from '../types'
import { newId, users } from './db'

/**
 * Accounts of mock mode. The demo account owns all the seeded topics; any account registered here
 * lives until the window reloads and sees the same demo data (the mocks have one data set).
 */
export const DEMO_LOGIN = 'denys'
export const DEMO_PASSWORD = 'prepdeck1'
/** The code every mock reset email "contains". */
export const DEMO_RESET_CODE = '123456'

interface Account {
  user: User
  password: string
}

const accounts = new Map<string, Account>([[users.me.id, { user: users.me, password: DEMO_PASSWORD }]])
for (const u of [users.andrii, users.olena, users.taras]) accounts.set(u.id, { user: u, password: newId('locked') })

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

type Respond = <T>(produce: () => T) => Promise<T>
type Fail = (message: string, status?: number) => never

export function createMockAuth(respond: Respond, fail: Fail): AuthRepository {
  return {
    login: (login, password) =>
      respond(() => {
        const account = find(login)
        if (!account || account.password !== password) return fail('auth.invalidCredentials', 401)
        return session(account.user)
      }),

    register: (email, username, password) =>
      respond(() => {
        const mail = email.trim().toLowerCase()
        const name = username.trim().toLowerCase()
        if (find(mail)) return fail('auth.emailTaken', 409)
        if (find(name)) return fail('auth.usernameTaken', 409)
        if (password.length < 8) return fail('auth.passwordRules')
        const user: User = { id: newId('u'), email: mail, username: name, name: username.trim() }
        accounts.set(user.id, { user, password })
        return session(user)
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
        if (code !== DEMO_RESET_CODE) return fail('auth.codeInvalid')
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
