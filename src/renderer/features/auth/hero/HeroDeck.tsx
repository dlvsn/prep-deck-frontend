import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties, type TransitionEvent } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './HeroDeck.module.css'
import shared from './hero.module.css'
import { DECK } from './samples'

/** How long the deck rests between deals. */
const REST_MS = 2500
/** The top card's flight off to the right; matches `.leaving` in the CSS. */
const LEAVE_MS = 900
/** The rest of the deck rising one slot and the bottom card fading in; matches `.card` in the CSS. */
const RISE_MS = 400
/** If `transitionend` never comes (transitions off while the window is being resized), move on anyway. */
const LEAVE_FALLBACK_MS = LEAVE_MS + 200
/** Slots drawn as a fan; cards past these wait, invisible, under the last one. */
const VISIBLE_SLOTS = 4
/** The deck only deals while the brand panel is on screen and the user has not asked for less motion. */
const DEALING_QUERY = '(min-width: 960px) and (prefers-reduced-motion: no-preference)'

/**
 * - `rest`: the deck stands still.
 * - `leaving`: the top card flies off.
 * - `placing`: the flown card has gone to the back of `order`; the rest rise a slot, and the card
 *   now entering the last visible slot is put just below it, invisible, with no transition.
 * - `rising`: that card fades up into its slot.
 */
type Motion = 'rest' | 'leaving' | 'placing' | 'rising'

interface DeckState {
  /** Card ids, top first. A card's place in the fan is its index here. */
  order: readonly string[]
  motion: Motion
}

/**
 * Picture E: a fanned-out deck that deals through its cards. Every few seconds the top card flies
 * off to the right and goes to the back of the deck, the others rise a slot, and the next question
 * is on top. The cycle is driven from JS because the order changes each time; the cards keep their
 * ids as keys and their DOM order, so they glide between slots instead of being redrawn.
 */
export function HeroDeck() {
  const { t } = useTranslation()
  const dealing = useMediaQuery(DEALING_QUERY)
  const [{ order, motion }, setState] = useState<DeckState>(() => ({ order: DECK.map((card) => card.id), motion: 'rest' }))

  const finishLeaving = useCallback(() => {
    setState((state) =>
      state.motion === 'leaving' ? { order: [...state.order.slice(1), state.order[0]], motion: 'placing' } : state
    )
  }, [])

  useEffect(() => {
    if (!dealing) {
      // Stopped mid-deal (window narrowed, reduced motion turned on): finish the deal at once.
      setState(settle)
      return
    }
    switch (motion) {
      case 'rest':
        return pausableTimeout(() => setState((state) => ({ ...state, motion: 'leaving' })), REST_MS)
      case 'leaving':
        return pausableTimeout(finishLeaving, LEAVE_FALLBACK_MS)
      case 'placing':
        return afterNextPaint(() => setState((state) => ({ ...state, motion: 'rising' })))
      case 'rising':
        return pausableTimeout(() => setState((state) => ({ ...state, motion: 'rest' })), RISE_MS)
    }
  }, [dealing, motion, finishLeaving])

  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'transform') finishLeaving()
  }

  const last = order.length - 1
  const entering = order[Math.min(order.length, VISIBLE_SLOTS) - 1]

  return (
    <div className={shared.stage} aria-hidden="true">
      <div className={styles.deck}>
        {DECK.map((card) => {
          const slot = order.indexOf(card.id)
          const leaving = motion === 'leaving' && slot === 0
          const placing = motion === 'placing' && (card.id === entering || slot === last)
          const classes = [
            shared.card,
            styles.card,
            slot === 0 && styles.top,
            leaving && styles.leaving,
            placing && styles.instant,
            placing && card.id === entering && styles.below
          ]
          return (
            <div
              key={card.id}
              className={classes.filter(Boolean).join(' ')}
              data-hidden={slot >= VISIBLE_SLOTS || undefined}
              style={{ '--slot': Math.min(slot, VISIBLE_SLOTS - 1), zIndex: 10 - slot } as CSSProperties}
              onTransitionEnd={leaving ? onTransitionEnd : undefined}
            >
              <span className={shared.chip} data-status={card.status}>
                {t(`filters.${card.status}`)}
              </span>
              <p className={styles.question}>{card.question}</p>
              <span className={styles.topic}>{card.topic}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Brings a deal in progress to rest, the flown card (if any) already at the back. */
function settle(state: DeckState): DeckState {
  switch (state.motion) {
    case 'rest':
      return state
    case 'leaving':
      return { order: [...state.order.slice(1), state.order[0]], motion: 'rest' }
    default:
      return { ...state, motion: 'rest' }
  }
}

/**
 * Like `setTimeout`, but the clock stops while the window is hidden and runs on from where it was
 * when it shows again, so a minimized window does not come back to a burst of deals. Returns the
 * cancel function.
 */
function pausableTimeout(callback: () => void, ms: number): () => void {
  let remaining = ms
  let startedAt = 0
  let timer: number | undefined
  let done = false

  const start = () => {
    startedAt = performance.now()
    timer = window.setTimeout(() => {
      done = true
      timer = undefined
      callback()
    }, remaining)
  }
  const onVisibilityChange = () => {
    if (done) return
    if (document.visibilityState === 'hidden') {
      if (timer === undefined) return
      window.clearTimeout(timer)
      timer = undefined
      remaining = Math.max(0, remaining - (performance.now() - startedAt))
    } else if (timer === undefined) {
      start()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  if (document.visibilityState !== 'hidden') start()
  return () => {
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

/**
 * Runs the callback once the current styles have been painted, so a change made with transitions
 * off lands before they come back on. Returns the cancel function.
 */
function afterNextPaint(callback: () => void): () => void {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(callback)
  })
  return () => cancelAnimationFrame(frame)
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
