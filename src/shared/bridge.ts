/**
 * The narrow API the preload script exposes to the renderer as `window.prepDeck`.
 * Shared by both sides so a change to one cannot silently drift from the other.
 */
export interface PrepDeckBridge {
  readonly kind: 'electron'
  /** The OS locale as Electron reports it, e.g. "uk" or "en-US". */
  readonly locale: string
  readonly version: string
  readonly window: WindowControls
  /** Encrypted with the OS keychain (DPAPI on Windows); never readable by other users. */
  readonly secureStore: SecureStore
}

export interface WindowControls {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  /** Returns the unsubscribe function. */
  onMaximizedChange(listener: (maximized: boolean) => void): () => void
}

export interface SecureStore {
  get(): Promise<string | null>
  set(value: string): Promise<void>
  clear(): Promise<void>
}
