import i18n from '@/i18n'
import type { ApiResponse } from './types'

/**
 * A failed call: the backend's message key, the HTTP status and, for some refusals, the data the
 * client needs to act on them (attempts left, the email still to confirm).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown = null
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface HttpClientOptions {
  baseUrl: string
  getAccessToken(): string | null
  /** Gets a fresh access token with the stored refresh token; resolves false when that fails. */
  refresh(): Promise<boolean>
  /** Called once refreshing has failed: the session is over and the login screen should show. */
  onSessionExpired(): void
}

export interface RequestOptions {
  /**
   * false: no access token is sent and a 401 is not answered with a refresh. For the calls that
   * create or renew a session (log in, refresh), where a 401 means "wrong password", not
   * "token expired".
   */
  auth?: boolean
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>
  delete<T>(path: string, options?: RequestOptions): Promise<T>
}

/**
 * fetch with the backend's conventions: every answer is an {@link ApiResponse}, unwrapped here so
 * callers get `data` or an {@link ApiError}; a 401 gets one silent refresh and one retry.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  let refreshing: Promise<boolean> | null = null

  // Parallel 401s share one refresh instead of racing each other with the same refresh token.
  const refreshOnce = (): Promise<boolean> => {
    refreshing ??= options.refresh().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function send<T>(method: string, path: string, body?: unknown, request: RequestOptions = {}, retried = false): Promise<T> {
    const withAuth = request.auth !== false
    const token = withAuth ? options.getAccessToken() : null
    // The language the backend writes letters in.
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': i18n.language }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'

    let response: Response
    try {
      response = await fetch(options.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
      })
    } catch {
      throw new ApiError('errors.offline', 0)
    }

    if (response.status === 401 && withAuth && !retried) {
      if (await refreshOnce()) return send<T>(method, path, body, request, true)
      options.onSessionExpired()
      throw new ApiError('errors.sessionExpired', 401)
    }

    let envelope: ApiResponse<T> | null = null
    try {
      envelope = (await response.json()) as ApiResponse<T>
    } catch {
      // A body that is not the envelope (a proxy error page, say) falls through to the status.
    }

    if (envelope && envelope.success && response.ok) return envelope.data as T
    throw new ApiError(envelope?.message || 'errors.generic', response.status, envelope?.data ?? null)
  }

  return {
    get: (path, request) => send('GET', path, undefined, request),
    post: (path, body, request) => send('POST', path, body, request),
    put: (path, body, request) => send('PUT', path, body, request),
    patch: (path, body, request) => send('PATCH', path, body, request),
    delete: (path, request) => send('DELETE', path, undefined, request)
  }
}
