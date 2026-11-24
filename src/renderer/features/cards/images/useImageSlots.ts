import { arrayMove } from '@dnd-kit/sortable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api'
import { ApiError, UploadAborted } from '@/api/http'
import type { CardImage, Id } from '@/api/types'
import i18n from '@/i18n'
import { errorText, useToasts } from '@/ui/toast'
import { isAcceptedImage, MAX_IMAGES, MIN_IMAGE_HEIGHT, MIN_IMAGE_WIDTH, prepareImage, type PreparedImage } from './imagePrep'

export type SlotStatus = 'uploading' | 'done' | 'error'

export interface ImageSlot {
  key: string
  status: SlotStatus
  /** 0…1 while uploading. */
  progress: number
  /** What the thumbnail shows: a local object URL until the server's copy has loaded. */
  preview: string
  /** Set once uploaded. */
  image: CardImage | null
}

/** Uploads running at once; the rest wait in a queue. */
const PARALLEL = 3

/** Refusals another try cannot change: the slot goes, with a toast, instead of offering ↻. */
const FINAL_REFUSALS = new Set(['images.tooLarge', 'images.notAnImage', 'images.tooSmall'])

let keySeq = 0
const newKey = (): string => `slot-${++keySeq}`

/** The server's minimum comes with "images.tooSmall"; other refusals read as they are. */
function refusalText(error: ApiError): string {
  if (error.message !== 'images.tooSmall') return errorText(error)
  const data = error.data as { minWidth?: number; minHeight?: number } | null
  return i18n.t('images.tooSmall', { width: data?.minWidth ?? MIN_IMAGE_WIDTH, height: data?.minHeight ?? MIN_IMAGE_HEIGHT })
}

const fromImage = (image: CardImage): ImageSlot => ({
  key: `image-${image.id}`,
  status: 'done',
  progress: 1,
  preview: image.url,
  image
})

/** Resolves when the picture is ready to draw (or failed), so the thumbnail swaps without a blank. */
function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

export interface ImageSlots {
  slots: ImageSlot[]
  /** Uploaded pictures in display order. */
  images: CardImage[]
  imageIds: Id[]
  uploading: number
  hasError: boolean
  free: number
  /** Every way to add pictures (drop, Browse, paste) ends here. Answers how many were taken. */
  addImages(files: File[]): number
  retry(key: string): void
  remove(key: string): void
  move(from: number, to: number): void
  /** Starts over from these pictures, dropping (and cancelling) everything else. */
  reset(images: CardImage[]): void
  /** Resolves when nothing is uploading any more: true when every slot made it, false otherwise. */
  waitForUploads(): Promise<boolean>
  /** The uploaded pictures right now, not as of the last render (for use after awaiting). */
  current(): CardImage[]
}

const doneImages = (slots: ImageSlot[]): CardImage[] =>
  slots.flatMap((s) => (s.status === 'done' && s.image ? [s.image] : []))

/**
 * The picture slots of one card: each accepted file takes a slot at once with a local preview,
 * and its upload starts right away (at most three at a time), without waiting for Save.
 * Object URLs are revoked once the server's copy shows, and when the slots go away.
 */
export function useImageSlots(initial: CardImage[]): ImageSlots {
  const [slots, setSlots] = useState<ImageSlot[]>(() => initial.map(fromImage))
  const slotsRef = useRef(slots)
  const files = useRef(new Map<string, Blob>())
  const controllers = useRef(new Map<string, AbortController>())
  const objectUrls = useRef(new Set<string>())
  const queue = useRef<string[]>([])
  const running = useRef(0)
  const waiters = useRef<Array<(ok: boolean) => void>>([])
  const alive = useRef(true)

  const commit = useCallback((next: ImageSlot[]) => {
    slotsRef.current = next
    if (alive.current) setSlots(next)
  }, [])

  const patch = useCallback(
    (key: string, change: Partial<ImageSlot>) =>
      commit(slotsRef.current.map((slot) => (slot.key === key ? { ...slot, ...change } : slot))),
    [commit]
  )

  const revoke = useCallback((url: string) => {
    if (objectUrls.current.delete(url)) URL.revokeObjectURL(url)
  }, [])

  const settleWaiters = useCallback(() => {
    const current = slotsRef.current
    if (current.some((s) => s.status === 'uploading')) return
    const ok = !current.some((s) => s.status === 'error')
    waiters.current.splice(0).forEach((resolve) => resolve(ok))
  }, [])

  const exists = (key: string): boolean => slotsRef.current.some((s) => s.key === key)

  /** Takes a slot out for good, with the reason as a toast. */
  const reject = useCallback(
    (key: string, reason: string) => {
      const slot = slotsRef.current.find((s) => s.key === key)
      if (!slot) return
      revoke(slot.preview)
      files.current.delete(key)
      commit(slotsRef.current.filter((s) => s.key !== key))
      useToasts.getState().show(reason)
    },
    [commit, revoke]
  )

  const run = useCallback(
    async (key: string): Promise<void> => {
      const file = files.current.get(key)
      if (!file) return
      const controller = new AbortController()
      controllers.current.set(key, controller)
      try {
        let prepared: PreparedImage
        try {
          prepared = await prepareImage(file)
        } catch {
          // The browser cannot decode it: whatever the extension says, it is not a picture.
          reject(key, i18n.t('images.notAnImage'))
          return
        }
        if (controller.signal.aborted || !exists(key)) return
        // Checked here to spare the upload; the server measures the file again and decides.
        if (prepared.width < MIN_IMAGE_WIDTH || prepared.height < MIN_IMAGE_HEIGHT) {
          reject(key, i18n.t('images.tooSmall', { width: MIN_IMAGE_WIDTH, height: MIN_IMAGE_HEIGHT }))
          return
        }
        const image = await api.images.upload(prepared.blob, {
          signal: controller.signal,
          onProgress: (progress) => patch(key, { progress })
        })
        await preload(image.url)
        const slot = slotsRef.current.find((s) => s.key === key)
        if (!slot) return
        patch(key, { status: 'done', progress: 1, image, preview: image.url })
        revoke(slot.preview)
        files.current.delete(key)
      } catch (error) {
        if (error instanceof UploadAborted || controller.signal.aborted || !exists(key)) return
        if (error instanceof ApiError && FINAL_REFUSALS.has(error.message)) reject(key, refusalText(error))
        else patch(key, { status: 'error' })
      } finally {
        controllers.current.delete(key)
        settleWaiters()
      }
    },
    [patch, revoke, reject, settleWaiters]
  )

  const pump = useCallback(() => {
    while (running.current < PARALLEL && queue.current.length > 0) {
      const key = queue.current.shift()!
      if (!exists(key)) continue
      running.current++
      void run(key).finally(() => {
        running.current--
        pump()
      })
    }
  }, [run])

  const addImages = useCallback(
    (input: File[]): number => {
      const toast = useToasts.getState().show
      const valid = input.filter(isAcceptedImage)
      const invalid = input.length - valid.length
      if (invalid > 0) toast(i18n.t('images.skippedInvalid', { count: invalid }))
      const free = Math.max(0, MAX_IMAGES - slotsRef.current.length)
      const taken = valid.slice(0, free)
      const overflow = valid.length - taken.length
      if (overflow > 0) toast(i18n.t('images.skippedOverflow', { max: MAX_IMAGES, count: overflow }))
      if (taken.length === 0) return 0

      const added = taken.map((file): ImageSlot => {
        const key = newKey()
        const preview = URL.createObjectURL(file)
        objectUrls.current.add(preview)
        files.current.set(key, file)
        queue.current.push(key)
        return { key, status: 'uploading', progress: 0, preview, image: null }
      })
      commit([...slotsRef.current, ...added])
      pump()
      return added.length
    },
    [commit, pump]
  )

  const retry = useCallback(
    (key: string) => {
      if (!files.current.has(key)) return
      patch(key, { status: 'uploading', progress: 0 })
      queue.current.push(key)
      pump()
    },
    [patch, pump]
  )

  const drop = useCallback(
    (slot: ImageSlot) => {
      controllers.current.get(slot.key)?.abort()
      revoke(slot.preview)
      files.current.delete(slot.key)
      queue.current = queue.current.filter((k) => k !== slot.key)
    },
    [revoke]
  )

  const remove = useCallback(
    (key: string) => {
      const slot = slotsRef.current.find((s) => s.key === key)
      if (!slot) return
      drop(slot)
      commit(slotsRef.current.filter((s) => s.key !== key))
      settleWaiters()
    },
    [commit, drop, settleWaiters]
  )

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to) return
      commit(arrayMove(slotsRef.current, from, to))
    },
    [commit]
  )

  const reset = useCallback(
    (images: CardImage[]) => {
      slotsRef.current.forEach(drop)
      commit(images.map(fromImage))
      settleWaiters()
    },
    [commit, drop, settleWaiters]
  )

  const waitForUploads = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        waiters.current.push(resolve)
        settleWaiters()
      }),
    [settleWaiters]
  )

  // Teardown waits a tick: React's StrictMode unmounts and remounts once in development, and
  // uploads already started (and their previews) must survive that.
  const teardown = useRef<number | null>(null)
  useEffect(() => {
    alive.current = true
    if (teardown.current !== null) window.clearTimeout(teardown.current)
    teardown.current = null
    const ctrls = controllers.current
    const urls = objectUrls.current
    return () => {
      alive.current = false
      teardown.current = window.setTimeout(() => {
        ctrls.forEach((c) => c.abort())
        urls.forEach((url) => URL.revokeObjectURL(url))
        urls.clear()
      }, 0)
    }
  }, [])

  const current = useCallback(() => doneImages(slotsRef.current), [])

  return useMemo(() => {
    const images = doneImages(slots)
    return {
      slots,
      images,
      imageIds: images.map((i) => i.id),
      uploading: slots.filter((s) => s.status === 'uploading').length,
      hasError: slots.some((s) => s.status === 'error'),
      free: MAX_IMAGES - slots.length,
      addImages,
      retry,
      remove,
      move,
      reset,
      waitForUploads,
      current
    }
  }, [slots, addImages, retry, remove, move, reset, waitForUploads, current])
}
