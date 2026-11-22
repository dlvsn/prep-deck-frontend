import type {
  Card,
  CardDraft,
  CardImage,
  DayProgress,
  Grade,
  Registration,
  Id,
  PracticeItem,
  PracticeScope,
  Role,
  Session,
  Settings,
  SettingsInput,
  Topic,
  TopicSharing,
  User
} from './types'

/**
 * What the UI may ask of the backend, one interface per area. Each has an in-memory mock
 * (api/mocks) and, once the backend exposes it, an HTTP implementation; the UI never knows which.
 */

export interface AuthRepository {
  /**
   * Rejects with "auth.invalidCredentials" when the login or the password is wrong, and with
   * "auth.emailNotVerified" (data: UnconfirmedEmail) when the right password meets an email not
   * yet confirmed: a code has just been sent to it.
   */
  login(login: string, password: string): Promise<Session>
  /**
   * Creates the account unconfirmed and emails a code. Rejects with "auth.emailTaken" or
   * "auth.usernameTaken" (a field error, shown under it).
   */
  register(email: string, username: string, password: string): Promise<Registration>
  /**
   * Confirms the email with the code and opens the first session. Rejects with
   * "auth.codeInvalid" (data: CodeAttempts), "auth.codeAttemptsExhausted" or "auth.codeExpired".
   */
  verifyEmail(email: string, code: string): Promise<Session>
  /** A new letter; rejects with "auth.resendTooSoon" (data: RetryAfter) inside the cooldown. */
  resendVerification(email: string): Promise<void>
  refresh(refreshToken: string): Promise<Session>
  /** Ends the session the refresh token belongs to. */
  logout(refreshToken: string): Promise<void>
  me(): Promise<User>
  /** Whether a username is still free, for the hint under the field while it is typed. */
  isUsernameFree(username: string): Promise<boolean>
  /** Sends a 6-digit code by email. Answers the same whether or not the email is known. */
  requestPasswordReset(email: string): Promise<void>
  /** Exchanges the code for a one-time reset token; rejects with "auth.codeInvalid". */
  verifyResetCode(email: string, code: string): Promise<string>
  resetPassword(resetToken: string, password: string): Promise<void>
}

export interface TopicsRepository {
  /** Topics the user owns, flat; parentId builds the tree. */
  listMine(): Promise<Topic[]>
  /** Topics shared with the user, flat, each carrying its owner. */
  listShared(): Promise<Topic[]>
  create(title: string, parentId: Id | null): Promise<Topic>
  rename(id: Id, title: string): Promise<Topic>
  /** Moves under a new parent (null: to the root) at the given position among its siblings. */
  move(id: Id, parentId: Id | null, order: number): Promise<Topic>
  /** Deletes the topic with all its subtopics and cards. */
  remove(id: Id): Promise<void>
  markSeen(id: Id): Promise<void>
}

export type CardSort = 'edited' | 'created' | 'alpha' | 'status'

export interface CardsRepository {
  /** Cards directly in the topic. */
  list(topicId: Id): Promise<Card[]>
  get(id: Id): Promise<Card>
  create(topicId: Id, draft: CardDraft): Promise<Card>
  update(id: Id, draft: CardDraft): Promise<Card>
  remove(id: Id): Promise<void>
  /** Questions, answers and tags across every topic the user can see. */
  search(query: string): Promise<Card[]>
}

export interface ImagesRepository {
  upload(file: Blob, caption?: string): Promise<CardImage>
}

export interface PracticeRepository {
  queue(scope: PracticeScope): Promise<PracticeItem[]>
  grade(cardId: Id, grade: Grade): Promise<Card>
  today(): Promise<DayProgress>
}

export interface SharesRepository {
  get(topicId: Id): Promise<TopicSharing>
  /** Rejects with "share.noSuchUser" when nobody has that email or username. */
  invite(topicId: Id, login: string, role: Exclude<Role, 'owner'>): Promise<TopicSharing>
  changeRole(topicId: Id, userId: Id, role: Exclude<Role, 'owner'>): Promise<TopicSharing>
  revoke(topicId: Id, userId: Id): Promise<TopicSharing>
  setLinkEnabled(topicId: Id, enabled: boolean): Promise<TopicSharing>
  /** Opens a shared link: the topic joins Shared with me as Can view. */
  acceptLink(token: string): Promise<Topic>
  leave(topicId: Id): Promise<void>
  /** Copies the topic with its subtopics and cards under parentId (null: the root). */
  copyToMine(topicId: Id, parentId: Id | null): Promise<Topic>
}

export interface SettingsRepository {
  get(): Promise<Settings>
  /** Replaces the whole set. */
  update(settings: SettingsInput): Promise<Settings>
}

export interface Repositories {
  auth: AuthRepository
  topics: TopicsRepository
  cards: CardsRepository
  images: ImagesRepository
  practice: PracticeRepository
  shares: SharesRepository
  settings: SettingsRepository
}
