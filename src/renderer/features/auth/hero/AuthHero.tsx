import { HeroCards } from './HeroCards'
import { HeroDeck } from './HeroDeck'
import { HeroFlip } from './HeroFlip'
import { HeroMesh } from './HeroMesh'
import { HeroStreak } from './HeroStreak'
import type { Hero } from './heroes'

/** The picture in the middle of the login screen's brand panel. */
export function AuthHero({ hero }: { hero: Hero }) {
  switch (hero) {
    case 'cards':
      return <HeroCards />
    case 'flip':
      return <HeroFlip />
    case 'streak':
      return <HeroStreak />
    case 'deck':
      return <HeroDeck />
    case 'mesh':
      return <HeroMesh />
  }
}
