/** What a card accepts (spec, «Картинки: завантаження»); the server checks the same. */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',')
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES = 5
/** The smallest picture accepted, as displayed (server: prep-deck.images.min-width / min-height). */
export const MIN_IMAGE_WIDTH = 64
export const MIN_IMAGE_HEIGHT = 64

/** Pictures larger than this on their longer side are scaled down before they go up. */
const MAX_SIDE = 2560
const QUALITY = 0.9

export const isAcceptedImage = (file: Blob): boolean =>
  (ACCEPTED_TYPES as readonly string[]).includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
}

/**
 * Reads the picture's size and scales it down to 2560 px on the longer side when it is bigger,
 * in the same format at quality 0.9. GIFs go up untouched: a canvas would keep one frame only.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    if (file.type === 'image/gif' || longest <= MAX_SIDE) return { blob: file, width, height }

    const scale = MAX_SIDE / longest
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const context = canvas.getContext('2d')
    if (!context) return { blob: file, width, height }
    context.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, QUALITY))
    return blob ? { blob, width: w, height: h } : { blob: file, width, height }
  } finally {
    bitmap.close()
  }
}

/** The image files among what was dropped or pasted, in order. */
export function filesOf(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return []
  const out: File[] = []
  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    const file = entry instanceof File ? entry : (entry as DataTransferItem).kind === 'file' ? (entry as DataTransferItem).getAsFile() : null
    if (file) out.push(file)
  }
  return out
}
