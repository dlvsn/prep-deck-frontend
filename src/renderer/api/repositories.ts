import type {
  Card,
  CardDraft,
  CardPatch,
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
 * What the UI may ask of the backend, one interface per area, each implemented over HTTP in
 * api/http. There are no mocks: the client needs prep-deck-backend running.
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
  create(title: string, parentId: Id | null): Promise<Topic>
  rename(id: Id, title: string): Promise<Topic>
  /** Moves under a new parent (null: to the root) at the given position among its siblings. */
  move(id: Id, parentId: Id | null, order: number): Promise<Topic>
  /** Deletes the topic with all its subtopics and cards. */
  remove(id: Id): Promise<void>
}

export interface CardsRepository {
  /** Cards directly in the topic, newest first. */
  list(topicId: Id): Promise<Card[]>
  get(id: Id): Promise<Card>
  /**
   * Rejects with "editor.questionRequired", "editor.tooManyTags", "editor.tooManyImages" or
   * "images.notFound" (an image id that is not one of the user's uploads).
   */
  create(topicId: Id, draft: CardDraft): Promise<Card>
  /** Changes what the patch carries; `topicId` moves the card to another topic. */
  update(id: Id, patch: CardPatch): Promise<Card>
  remove(id: Id): Promise<void>
  /** A copy in the same topic with the same tags and images, and no progress. */
  duplicate(id: Id, question: string): Promise<Card>
  /** Every tag on the user's cards, for suggestions in the editor. */
  tags(): Promise<string[]>
}

export interface UploadOptions {
  /** 0…1 as the bytes go out. */
  onProgress?(fraction: number): void
  /** Aborting rejects with an `UploadAborted` (api/http). */
  signal?: AbortSignal
}

export interface ImagesRepository {
  /**
   * Uploads a picture before the card that shows it is saved; the card then lists its id. The
   * server measures the file itself (weight, format, width and height). Rejects with
   * "images.tooLarge", "images.notAnImage" or "images.tooSmall" (data: minWidth, minHeight).
   */
  upload(file: Blob, options?: UploadOptions): Promise<CardImage>
}

/*
 * Not served by the backend yet, so not part of {@link Repositories}: the calls practice (stage 5)
 * and sharing (stage 6) will make, kept as the contract the backend is to implement.
 */

export interface PracticeRepository {
  queue(scope: PracticeScope): Promise<PracticeItem[]>
  grade(cardId: Id, grade: Grade): Promise<Card>
  today(): Promise<DayProgress>
}

export interface SharesRepository {
  /** Topics shared with the user, flat, each carrying its owner. */
  listShared(): Promise<Topic[]>
  markSeen(topicId: Id): Promise<void>
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
  settings: SettingsRepository
}
