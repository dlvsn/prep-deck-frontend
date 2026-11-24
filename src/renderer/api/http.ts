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

/** An upload stopped on purpose (its slot was removed); not an error to show. */
export class UploadAborted extends Error {
  constructor() {
    super('upload aborted')
    this.name = 'UploadAborted'
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
  /**
   * A multipart POST over XMLHttpRequest, which (unlike fetch) reports upload progress. Same
   * envelope, same single refresh on 401.
   */
  upload<T>(path: string, form: FormData, progress?: { onProgress?(fraction: number): void; signal?: AbortSignal }): Promise<T>
}

interface RawResponse {
  status: number
  body: string
}

function sendXhr(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAborted())
      return
    }
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
    xhr.onerror = () => reject(new ApiError('errors.offline', 0))
    xhr.onabort = () => reject(new UploadAborted())
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(form)
  })
}

function unwrap<T>(status: number, envelope: ApiResponse<T> | null): T {
  if (envelope && envelope.success && status >= 200 && status < 300) return envelope.data as T
  throw new ApiError(envelope?.message || 'errors.generic', status, envelope?.data ?? null)
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

    return unwrap(response.status, envelope)
  }

  async function upload<T>(
    path: string,
    form: FormData,
    progress: { onProgress?(fraction: number): void; signal?: AbortSignal } = {},
    retried = false
  ): Promise<T> {
    const token = options.getAccessToken()
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': i18n.language }
    if (token) headers.Authorization = `Bearer ${token}`

    const response = await sendXhr(options.baseUrl + path, form, headers, progress.onProgress, progress.signal)
    if (response.status === 401 && !retried) {
      if (await refreshOnce()) return upload<T>(path, form, progress, true)
      options.onSessionExpired()
      throw new ApiError('errors.sessionExpired', 401)
    }

    let envelope: ApiResponse<T> | null = null
    try {
      envelope = JSON.parse(response.body) as ApiResponse<T>
    } catch {
      // Not the envelope: fall through to the status.
    }
    return unwrap(response.status, envelope)
  }

  return {
    get: (path, request) => send('GET', path, undefined, request),
    post: (path, body, request) => send('POST', path, body, request),
    put: (path, body, request) => send('PUT', path, body, request),
    patch: (path, body, request) => send('PATCH', path, body, request),
    delete: (path, request) => send('DELETE', path, undefined, request),
    upload: (path, form, progress) => upload(path, form, progress)
  }
}
