/**
 * Shapes exchanged with the backend. Hand-written until the backend publishes an OpenAPI
 * contract; then these are replaced by generated ones.
 */

/** The envelope every backend endpoint answers with (prep-deck-backend `ApiResponse<T>`). */
export interface ApiResponse<T> {
  success: boolean
  /** User-facing text on failure; optional on success. */
  message: string | null
  data: T | null
}

export type Id = string
/** ISO-8601 date-time string. */
export type Instant = string

export interface User {
  id: Id
  username: string
  email: string
  name: string
}

export interface Session {
  accessToken: string
  refreshToken: string
  user: User
}

/** The caller's role on a topic. Owner of their own topics; editor or viewer on shared ones. */
export type Role = 'owner' | 'editor' | 'viewer'

export interface Topic {
  id: Id
  parentId: Id | null
  title: string
  /** Position among siblings. */
  order: number
  owner: User
  role: Role
  /** True when the topic has been shared with anyone (shows the "shared" icon in My topics). */
  shared: boolean
  /** Cards directly in this topic, without subtopics; the tree sums them up. */
  cardCount: number
  /** This user's due cards directly in this topic. Progress is always personal. */
  dueCount: number
  /** A shared topic the user has not opened yet. */
  unseen: boolean
}

export type CardStatus = 'new' | 'learning' | 'known'

export interface CardImage {
  id: Id
  url: string
  caption: string | null
}

export interface Card {
  id: Id
  topicId: Id
  question: string
  /** Markdown. */
  answer: string
  tags: string[]
  /** At most five, in display order. */
  images: CardImage[]
  status: CardStatus
  /** When the card is next due for this user; null while it is new. */
  dueAt: Instant | null
  createdAt: Instant
  updatedAt: Instant
}

export interface CardDraft {
  question: string
  answer: string
  tags: string[]
  imageIds: Id[]
}

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface PracticeItem {
  card: Card
  /** Seconds until the card would next be due after each grade; shown on the grade buttons. */
  nextIntervals: Record<Grade, number>
}

export interface PracticeScope {
  /** Omitted: every due card the user can see. Given: that topic and its subtopics. */
  topicId?: Id
}

export interface Share {
  user: User
  role: Exclude<Role, 'owner'>
}

export interface TopicSharing {
  topicId: Id
  owner: User
  people: Share[]
  linkEnabled: boolean
  /** Present while the link is enabled; opens as prepdeck://topic/<token>. */
  linkToken: string | null
}

export interface Settings {
  mode: 'dark' | 'light'
  accent: string
  language: 'en' | 'uk'
}

export interface DayProgress {
  reviewed: number
  total: number
}
