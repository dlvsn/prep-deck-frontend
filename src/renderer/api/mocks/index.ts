import { ApiError } from '../http'
import type { Repositories } from '../repositories'
import type { CardDraft, Id, Role, Session, Settings, Topic, TopicSharing } from '../types'
import { db, isDue, newId, toCard, users, type StoredCard } from './db'
import { next, nextIntervals, statusOf } from './srs'

/** Every mock call waits 200–400 ms, so loading states show up as they will against a server. */
const delay = (): Promise<void> => new Promise((r) => setTimeout(r, 200 + Math.random() * 200))

async function respond<T>(produce: () => T): Promise<T> {
  await delay()
  return produce()
}

const fail = (message: string, status = 400): never => {
  throw new ApiError(message, status)
}

const DAILY_NEW_LIMIT = 20
const DAY_MS = 24 * 60 * 60 * 1000

let settings: Settings = { mode: 'dark', accent: 'mint', language: 'en' }

// ---------------------------------------------------------------- helpers

function roleOn(topicId: Id): Role | null {
  let id: Id | null = topicId
  while (id) {
    const topic = db.topics.get(id)
    if (!topic) return null
    if (topic.owner.id === users.me.id) return 'owner'
    const shared = db.sharedWithMe.get(id)
    if (shared) return shared
    id = topic.parentId
  }
  return null
}

function requireRole(topicId: Id, allowed: Role[]): Role {
  const role = roleOn(topicId)
  if (!role) return fail('errors.noAccess', 404)
  if (!allowed.includes(role)) return fail('errors.forbidden', 403)
  return role
}

function descendants(topicId: Id): Id[] {
  const out: Id[] = [topicId]
  for (let i = 0; i < out.length; i++) {
    for (const t of db.topics.values()) if (t.parentId === out[i]) out.push(t.id)
  }
  return out
}

function toTopic(id: Id): Topic {
  const t = db.topics.get(id) ?? fail('errors.noAccess', 404)
  const cards = [...db.cards.values()].filter((c) => c.topicId === id)
  return {
    ...t,
    role: roleOn(id) ?? 'viewer',
    cardCount: cards.length,
    dueCount: cards.filter((c) => isDue(c)).length
  }
}

function getCard(id: Id): StoredCard {
  const card = db.cards.get(id) ?? fail('errors.noAccess', 404)
  requireRole(card.topicId, ['owner', 'editor', 'viewer'])
  return card
}

function applyDraft(card: StoredCard, draft: CardDraft): void {
  if (!draft.question.trim()) fail('editor.questionRequired')
  if (draft.imageIds.length > 5) fail('editor.tooManyImages')
  card.question = draft.question.trim()
  card.answer = draft.answer
  card.tags = [...new Set(draft.tags.map((t) => t.trim().replace(/^#/, '')).filter(Boolean))]
  card.images = draft.imageIds.map((id) => db.images.get(id) ?? fail('errors.generic'))
  card.updatedAt = new Date().toISOString()
}

function sharingOf(topicId: Id): TopicSharing {
  const topic = db.topics.get(topicId) ?? fail('errors.noAccess', 404)
  const stored = db.sharing.get(topicId) ?? { people: [], linkEnabled: false, linkToken: null }
  return { topicId, owner: topic.owner, ...stored, people: [...stored.people] }
}

function saveSharing(sharing: TopicSharing): TopicSharing {
  const { people, linkEnabled, linkToken } = sharing
  db.sharing.set(sharing.topicId, { people, linkEnabled, linkToken })
  db.topics.get(sharing.topicId)!.shared = people.length > 0 || linkEnabled
  return sharingOf(sharing.topicId)
}

function copyTree(sourceId: Id, parentId: Id | null, order: number): Id {
  const source = db.topics.get(sourceId)!
  const id = newId('t')
  db.topics.set(id, { id, parentId, title: source.title, order, owner: users.me, shared: false, unseen: false })
  for (const card of [...db.cards.values()].filter((c) => c.topicId === sourceId)) {
    const copy: StoredCard = { ...card, id: newId('c'), topicId: id, srs: { ...card.srs }, images: [...card.images] }
    db.cards.set(copy.id, copy)
  }
  const children = [...db.topics.values()].filter((t) => t.parentId === sourceId)
  children.forEach((child) => copyTree(child.id, id, child.order))
  return id
}

const fakeSession = (): Session => ({
  accessToken: newId('access'),
  refreshToken: newId('refresh'),
  user: users.me
})

// ---------------------------------------------------------------- repositories

export function createMockRepositories(): Repositories {
  return {
    auth: {
      // Any credentials open the demo account; real checks arrive with the backend.
      login: (login, password) =>
        respond(() => {
          if (!login.trim()) fail('auth.loginRequired')
          if (!password) fail('auth.passwordRequired')
          return fakeSession()
        }),
      register: (email, username, password) =>
        respond(() => {
          if (!email.includes('@')) fail('auth.emailInvalid')
          if (!username.trim()) fail('auth.usernameRequired')
          if (password.length < 8) fail('auth.passwordTooShort')
          return fakeSession()
        }),
      refresh: () => respond(fakeSession),
      logout: () => respond(() => undefined),
      me: () => respond(() => users.me)
    },

    topics: {
      listMine: () =>
        respond(() => [...db.topics.values()].filter((t) => t.owner.id === users.me.id).map((t) => toTopic(t.id))),
      listShared: () =>
        respond(() => [...db.sharedWithMe.keys()].flatMap(descendants).map(toTopic)),
      create: (title, parentId) =>
        respond(() => {
          if (!title.trim()) fail('topics.titleRequired')
          if (parentId) requireRole(parentId, ['owner', 'editor'])
          const owner = parentId ? db.topics.get(parentId)!.owner : users.me
          const siblings = [...db.topics.values()].filter((t) => t.parentId === parentId)
          const id = newId('t')
          db.topics.set(id, { id, parentId, title: title.trim(), order: siblings.length, owner, shared: false, unseen: false })
          return toTopic(id)
        }),
      rename: (id, title) =>
        respond(() => {
          requireRole(id, ['owner', 'editor'])
          if (!title.trim()) fail('topics.titleRequired')
          db.topics.get(id)!.title = title.trim()
          return toTopic(id)
        }),
      move: (id, parentId, order) =>
        respond(() => {
          const topic = db.topics.get(id) ?? fail('errors.noAccess', 404)
          requireRole(id, topic.parentId === null ? ['owner'] : ['owner', 'editor'])
          if (parentId && descendants(id).includes(parentId)) fail('topics.moveIntoItself')
          if (parentId) requireRole(parentId, ['owner', 'editor'])
          const siblings = [...db.topics.values()]
            .filter((t) => t.parentId === parentId && t.id !== id)
            .sort((a, b) => a.order - b.order)
          siblings.splice(Math.max(0, Math.min(order, siblings.length)), 0, topic)
          siblings.forEach((t, i) => (t.order = i))
          topic.parentId = parentId
          return toTopic(id)
        }),
      remove: (id) =>
        respond(() => {
          const topic = db.topics.get(id) ?? fail('errors.noAccess', 404)
          requireRole(id, topic.parentId === null ? ['owner'] : ['owner', 'editor'])
          for (const tid of descendants(id)) {
            for (const card of [...db.cards.values()]) if (card.topicId === tid) db.cards.delete(card.id)
            db.topics.delete(tid)
            db.sharing.delete(tid)
          }
        }),
      markSeen: (id) =>
        respond(() => {
          const topic = db.topics.get(id)
          if (topic) topic.unseen = false
        })
    },

    cards: {
      list: (topicId) =>
        respond(() => {
          requireRole(topicId, ['owner', 'editor', 'viewer'])
          return [...db.cards.values()].filter((c) => c.topicId === topicId).map(toCard)
        }),
      get: (id) => respond(() => toCard(getCard(id))),
      create: (topicId, draft) =>
        respond(() => {
          requireRole(topicId, ['owner', 'editor'])
          const now = new Date().toISOString()
          const card: StoredCard = {
            id: newId('c'),
            topicId,
            question: '',
            answer: '',
            tags: [],
            images: [],
            srs: { intervalDays: 0, ease: 2.5, reps: 0 },
            due: null,
            createdAt: now,
            updatedAt: now
          }
          applyDraft(card, draft)
          db.cards.set(card.id, card)
          return toCard(card)
        }),
      update: (id, draft) =>
        respond(() => {
          const card = getCard(id)
          requireRole(card.topicId, ['owner', 'editor'])
          applyDraft(card, draft)
          return toCard(card)
        }),
      remove: (id) =>
        respond(() => {
          const card = getCard(id)
          requireRole(card.topicId, ['owner', 'editor'])
          db.cards.delete(id)
        }),
      search: (query) =>
        respond(() => {
          const q = query.trim().toLowerCase().replace(/^#/, '')
          if (!q) return []
          return [...db.cards.values()]
            .filter((c) => roleOn(c.topicId))
            .filter(
              (c) =>
                c.question.toLowerCase().includes(q) ||
                c.answer.toLowerCase().includes(q) ||
                c.tags.some((t) => t.toLowerCase().includes(q))
            )
            .map(toCard)
        })
    },

    images: {
      upload: (file, caption) =>
        respond(() => {
          const image = { id: newId('img'), url: URL.createObjectURL(file), caption: caption ?? null }
          db.images.set(image.id, image)
          return image
        })
    },

    practice: {
      queue: (scope) =>
        respond(() => {
          const topics = scope.topicId
            ? descendants(scope.topicId)
            : [...db.topics.keys()].filter((id) => roleOn(id))
          const inScope = [...db.cards.values()].filter((c) => topics.includes(c.topicId))
          const due = inScope.filter((c) => isDue(c)).sort((a, b) => a.due! - b.due!)
          const fresh = inScope.filter((c) => statusOf(c.srs) === 'new').slice(0, DAILY_NEW_LIMIT)
          return [...due, ...fresh].map((c) => ({ card: toCard(c), nextIntervals: nextIntervals(c.srs) }))
        }),
      grade: (cardId, grade) =>
        respond(() => {
          const card = getCard(cardId)
          card.srs = next(card.srs, grade)
          card.due = Date.now() + (card.srs.intervalDays === 0 ? 60_000 : card.srs.intervalDays * DAY_MS)
          db.reviewedToday++
          return toCard(card)
        }),
      today: () =>
        respond(() => {
          const due = [...db.cards.values()].filter((c) => roleOn(c.topicId) && isDue(c)).length
          return { reviewed: db.reviewedToday, total: db.reviewedToday + due }
        })
    },

    shares: {
      get: (topicId) =>
        respond(() => {
          requireRole(topicId, ['owner'])
          return sharingOf(topicId)
        }),
      invite: (topicId, login, role) =>
        respond(() => {
          requireRole(topicId, ['owner'])
          const needle = login.trim().toLowerCase()
          const user = Object.values(users).find((u) => u.email === needle || u.username === needle)
          if (!user || user.id === users.me.id) return fail('share.noSuchUser', 404)
          const sharing = sharingOf(topicId)
          const existing = sharing.people.find((p) => p.user.id === user.id)
          if (existing) existing.role = role
          else sharing.people.push({ user, role })
          return saveSharing(sharing)
        }),
      changeRole: (topicId, userId, role) =>
        respond(() => {
          requireRole(topicId, ['owner'])
          const sharing = sharingOf(topicId)
          sharing.people = sharing.people.map((p) => (p.user.id === userId ? { ...p, role } : p))
          return saveSharing(sharing)
        }),
      revoke: (topicId, userId) =>
        respond(() => {
          requireRole(topicId, ['owner'])
          const sharing = sharingOf(topicId)
          sharing.people = sharing.people.filter((p) => p.user.id !== userId)
          return saveSharing(sharing)
        }),
      setLinkEnabled: (topicId, enabled) =>
        respond(() => {
          requireRole(topicId, ['owner'])
          const sharing = sharingOf(topicId)
          sharing.linkEnabled = enabled
          sharing.linkToken = enabled ? (sharing.linkToken ?? newId('link')) : null
          return saveSharing(sharing)
        }),
      acceptLink: (token) =>
        respond(() => {
          const entry = [...db.sharing.entries()].find(([, s]) => s.linkEnabled && s.linkToken === token)
          if (!entry) return fail('share.linkInvalid', 404)
          const [topicId] = entry
          if (!roleOn(topicId)) db.sharedWithMe.set(topicId, 'viewer')
          return toTopic(topicId)
        }),
      leave: (topicId) =>
        respond(() => {
          if (!db.sharedWithMe.delete(topicId)) fail('errors.noAccess', 404)
        }),
      copyToMine: (topicId, parentId) =>
        respond(() => {
          requireRole(topicId, ['editor', 'viewer'])
          if (parentId) requireRole(parentId, ['owner'])
          const siblings = [...db.topics.values()].filter((t) => t.parentId === parentId && t.owner.id === users.me.id)
          return toTopic(copyTree(topicId, parentId, siblings.length))
        })
    },

    settings: {
      get: () => respond(() => settings),
      update: (value) =>
        respond(() => {
          settings = { ...value }
          return settings
        })
    }
  }
}

