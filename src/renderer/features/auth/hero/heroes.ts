/** The pictures the login screen's brand panel can show, as mockups A, B, C, E, F draw them. */
export const HEROES = ['cards', 'flip', 'streak', 'deck', 'mesh'] as const

export type Hero = (typeof HEROES)[number]

const STORAGE_KEY = 'prep-deck.auth-hero'

let chosen: Hero | null = null

/**
 * The picture for this launch: picked at random the first time the login screen shows, never the
 * one the previous launch showed, and kept until the app restarts (signing out shows it again).
 */
export function launchHero(): Hero {
  if (chosen) return chosen
  const last = readLast()
  const pool = HEROES.filter((hero) => hero !== last)
  chosen = pool[Math.floor(Math.random() * pool.length)] ?? HEROES[0]
  writeLast(chosen)
  return chosen
}

function readLast(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeLast(hero: Hero): void {
  try {
    localStorage.setItem(STORAGE_KEY, hero)
  } catch {
    // Storage blocked: the next launch may repeat this picture, nothing worse.
  }
}
