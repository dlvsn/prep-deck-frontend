import type { CardStatus, Grade } from '../types'

/**
 * Simplified SM-2, the same rules the backend is to apply, so mock mode behaves like the real
 * thing. Intervals are in days; 0 means "again within this session".
 */
export interface SrsState {
  intervalDays: number
  ease: number
  reps: number
}

export const NEW_CARD: SrsState = { intervalDays: 0, ease: 2.5, reps: 0 }

const MIN_EASE = 1.3
const KNOWN_FROM_DAYS = 21
const DAY = 24 * 60 * 60

/** A card never answered, or reset by Again, starts from these instead of multiplying zero. */
const FIRST_INTERVAL: Record<Exclude<Grade, 'again'>, number> = { hard: 1, good: 3, easy: 8 }

export function next(state: SrsState, grade: Grade): SrsState {
  if (grade === 'again') {
    return { intervalDays: 0, ease: Math.max(MIN_EASE, state.ease - 0.2), reps: state.reps + 1 }
  }
  const fresh = state.intervalDays === 0
  let intervalDays: number
  let ease = state.ease
  switch (grade) {
    case 'hard':
      intervalDays = fresh ? FIRST_INTERVAL.hard : state.intervalDays * 1.2
      ease = Math.max(MIN_EASE, ease - 0.15)
      break
    case 'good':
      intervalDays = fresh ? FIRST_INTERVAL.good : state.intervalDays * ease
      break
    case 'easy':
      intervalDays = fresh ? FIRST_INTERVAL.easy : state.intervalDays * ease * 1.3
      ease += 0.15
      break
  }
  return { intervalDays: Math.round(intervalDays * 10) / 10, ease, reps: state.reps + 1 }
}

export function statusOf(state: SrsState): CardStatus {
  if (state.reps === 0) return 'new'
  return state.intervalDays >= KNOWN_FROM_DAYS ? 'known' : 'learning'
}

/** Seconds until due after each grade, for the labels on the grade buttons. Again is under a minute. */
export function nextIntervals(state: SrsState): Record<Grade, number> {
  return {
    again: 30,
    hard: next(state, 'hard').intervalDays * DAY,
    good: next(state, 'good').intervalDays * DAY,
    easy: next(state, 'easy').intervalDays * DAY
  }
}
