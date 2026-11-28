/**
 * Shapes exchanged with the backend (prep-deck-backend, the `*Response` / `*Request` records).
 * Hand-written until the backend publishes an OpenAPI contract; then these are replaced by
 * generated ones.
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

/** Sign-up accepted: a letter with a code went to `email`; the session comes with the code. */
export interface Registration {
  email: string
  codeTtlMinutes: number
  /** Seconds before another letter may be asked for. */
  resendAfterSeconds: number
}

/** `data` of an "auth.emailNotVerified" refusal at log in: a code went to this email. */
export interface UnconfirmedEmail {
  email: string
  resendAfterSeconds: number
}

/** `data` of an "auth.codeInvalid" refusal. */
export interface CodeAttempts {
  attemptsLeft: number
}

/** `data` of an "auth.resendTooSoon" refusal. */
export interface RetryAfter {
  retryAfterSeconds: number
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
  /**
   * Shared with me only: where the part the user sees starts (`parentId` null) under parents
   * they cannot see, their titles from the top ("Java" for a shared "Java / JVM"). Empty
   * otherwise.
   */
  path: string[]
}

export type CardStatus = 'new' | 'learning' | 'known'

/** An uploaded picture. `url` is absolute and loads without a token. */
export interface CardImage {
  id: Id
  url: string
  width: number
  height: number
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
  /** Uploads, in display order; the first is the main picture. */
  imageIds: Id[]
}

/** A partial update; `topicId` moves the card. Practice progress is never touched by an edit. */
export type CardPatch = Partial<CardDraft> & { topicId?: Id }

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

/** A role the owner can hand to someone else. */
export type SharedRole = Exclude<Role, 'owner'>

/** Someone with access to part of a tree. */
export interface ShareMember {
  user: User
  role: SharedRole
  /** Every topic they have came through the public link. */
  viaLink: boolean
  /** The topics granted to them, each with its whole subtree, in tree order. */
  topicIds: Id[]
  since: Instant
}

/** An invitation letter not accepted yet. */
export interface PendingInvite {
  id: Id
  email: string
  topicIds: Id[]
  invitedAt: Instant
  expiresAt: Instant
}

/** The tree's public link; `token` and `url` only while it is enabled. */
export interface ShareLink {
  enabled: boolean
  token: string | null
  url: string | null
  topicIds: Id[]
  /** People who came through the link alone. */
  joinedCount: number
}

/** Who can see a tree (prep-deck-backend `SharingResponse`), whichever of its topics was asked. */
export interface TopicSharing {
  rootTopicId: Id
  owner: User
  people: ShareMember[]
  invites: PendingInvite[]
  link: ShareLink
}

/** What a user picks, kept on the server so every device they sign in on starts the same. */
export interface SettingsInput {
  mode: 'dark' | 'light'
  accent: string
  language: 'en' | 'uk'
  /** The topic opened last; null when none. */
  lastTopicId: Id | null
}

/**
 * The saved settings. Before the first save `updatedAt` is null and so is everything else: the
 * client then uploads what it has instead of taking the server's.
 */
export type Settings =
  | (SettingsInput & { updatedAt: Instant })
  | { mode: null; accent: null; language: null; lastTopicId: null; updatedAt: null }

export interface DayProgress {
  reviewed: number
  total: number
}
