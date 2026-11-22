import { create } from 'zustand'
import i18n from '@/i18n'
import { ApiError } from '@/api/http'

interface Toast {
  id: number
  message: string
}

interface ToastState {
  toasts: Toast[]
  show(message: string): void
  dismiss(id: number): void
}

const LIFETIME_MS = 3000
let nextId = 0

/** Short notices without buttons that leave on their own after three seconds. */
export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message) => {
    const id = nextId++
    set({ toasts: [...get().toasts.slice(-2), { id, message }] })
    setTimeout(() => get().dismiss(id), LIFETIME_MS)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))

/**
 * Words for a failure: the backend's message, translated when it is one of our keys (the mocks
 * answer with keys), shown as is when the backend already wrote it for the user.
 */
export function errorText(error: unknown): string {
  const message = error instanceof ApiError ? error.message : ''
  if (message && i18n.exists(message)) return i18n.t(message as 'errors.generic')
  return message || i18n.t('errors.generic')
}

export const toastError = (error: unknown): void => useToasts.getState().show(errorText(error))
