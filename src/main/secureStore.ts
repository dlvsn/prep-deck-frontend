import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * One secret (the refresh token) encrypted with the OS keychain via safeStorage. The renderer
 * never sees the file; it asks main through IPC.
 */
const file = (): string => join(app.getPath('userData'), 'session.bin')

export function readSecret(): string | null {
  try {
    if (!existsSync(file()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(file()))
  } catch {
    return null
  }
}

export function writeSecret(value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable; refusing to store the token in plain text')
  }
  writeFileSync(file(), safeStorage.encryptString(value))
}

export function clearSecret(): void {
  rmSync(file(), { force: true })
}
