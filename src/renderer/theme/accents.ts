/** The eight accents, in the order the Appearance popover shows them. Colours live in tokens.css. */
export const ACCENTS = ['mint', 'pink', 'purple', 'blue', 'orange', 'green', 'yellow', 'red'] as const

export type Accent = (typeof ACCENTS)[number]
export type Mode = 'dark' | 'light'

export const isAccent = (value: unknown): value is Accent =>
  typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)
