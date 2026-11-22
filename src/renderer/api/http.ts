import type { ApiResponse } from './types'

/** A failed call, carrying the backend's user-facing message. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
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

export interface HttpClient {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  delete<T>(path: string): Promise<T>
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

  async function send<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
    const token = options.getAccessToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
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

    if (response.status === 401 && !retried) {
      if (await refreshOnce()) return send<T>(method, path, body, true)
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
    throw new ApiError(envelope?.message || 'errors.generic', response.status)
  }

  return {
    get: (path) => send('GET', path),
    post: (path, body) => send('POST', path, body),
    put: (path, body) => send('PUT', path, body),
    patch: (path, body) => send('PATCH', path, body),
    delete: (path) => send('DELETE', path)
  }
}
