import type { Card, CardImage, Id, Topic, TopicSharing, User } from '../types'
import { NEW_CARD, statusOf, type SrsState } from './srs'

/**
 * The in-memory "server" behind every mock repository, seeded with the content of the mockups.
 * Lives for the lifetime of the window; a reload starts from the seed again.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const users = {
  me: { id: 'u-denys', username: 'denys', email: 'denys@example.com', name: 'Denys' },
  andrii: { id: 'u-andrii', username: 'andrii', email: 'andrii@example.com', name: 'Andrii K.' },
  olena: { id: 'u-olena', username: 'olena', email: 'olena@example.com', name: 'Olena M.' },
  taras: { id: 'u-taras', username: 'taras', email: 'taras@example.com', name: 'Taras P.' }
} satisfies Record<string, User>

export interface StoredCard extends Omit<Card, 'status' | 'dueAt'> {
  srs: SrsState
  /** Epoch ms; null while new. */
  due: number | null
}

export interface Db {
  topics: Map<Id, Omit<Topic, 'cardCount' | 'dueCount' | 'role'>>
  cards: Map<Id, StoredCard>
  sharing: Map<Id, Omit<TopicSharing, 'topicId' | 'owner'>>
  /** Topic ids shared with the current user, with their role. */
  sharedWithMe: Map<Id, 'editor' | 'viewer'>
  images: Map<Id, CardImage>
  reviewedToday: number
}

let seq = 0
export const newId = (prefix: string): Id => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** A placeholder picture: a tinted panel with its caption, as on the mockup. */
function placeholder(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="#1d222a"/>
<text x="400" y="310" fill="#8f99a7" font-family="Inter, sans-serif" font-size="28" text-anchor="middle">[${label}]</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

type Seed = 'new' | 'due' | 'learning' | 'known'

const SEED_STATE: Record<Exclude<Seed, 'new'>, { srs: SrsState; dueInDays: number }> = {
  due: { srs: { intervalDays: 3, ease: 2.35, reps: 2 }, dueInDays: 0 },
  learning: { srs: { intervalDays: 6, ease: 2.5, reps: 2 }, dueInDays: 4 },
  known: { srs: { intervalDays: 30, ease: 2.65, reps: 5 }, dueInDays: 18 }
}

function seedCard(
  db: Db,
  topicId: Id,
  seed: Seed,
  question: string,
  answer: string,
  tags: string[],
  imageLabels: string[] = [],
  editedDaysAgo = 1
): void {
  const id = newId('c')
  const now = Date.now()
  const images = imageLabels.map((label) => {
    const image: CardImage = { id: newId('img'), url: placeholder(label), caption: null }
    db.images.set(image.id, image)
    return image
  })
  const state = seed === 'new' ? null : SEED_STATE[seed]
  db.cards.set(id, {
    id,
    topicId,
    question,
    answer,
    tags,
    images,
    srs: state ? state.srs : NEW_CARD,
    due: state ? now + state.dueInDays * DAY_MS - (seed === 'due' ? 60_000 : 0) : null,
    createdAt: new Date(now - (editedDaysAgo + 30) * DAY_MS).toISOString(),
    updatedAt: new Date(now - editedDaysAgo * DAY_MS).toISOString()
  })
}

function seedTopic(db: Db, id: Id, title: string, parentId: Id | null, order: number, owner: User = users.me): Id {
  db.topics.set(id, { id, parentId, title, order, owner, shared: false, unseen: false })
  return id
}

const HEAP_ANSWER = `Objects live in the heap, which is shared by all threads. Most HotSpot collectors split it into generations, because most objects die young:

- **Young generation** — Eden plus two Survivor spaces. New objects start in Eden; a minor GC copies the live ones into a Survivor space.
- **Old generation** — objects that survived enough minor GCs are promoted here and collected less often.
- **Metaspace** (Java 8+) — class metadata in native memory outside the heap; it replaced PermGen.

\`\`\`shell
# heap size and metaspace limit
java -Xms512m -Xmx2g -XX:MaxMetaspaceSize=256m -jar app.jar
\`\`\``

function seed(): Db {
  const db: Db = {
    topics: new Map(),
    cards: new Map(),
    sharing: new Map(),
    sharedWithMe: new Map(),
    images: new Map(),
    reviewedToday: 14
  }

  // ---- My topics
  const java = seedTopic(db, 't-java', 'Java', null, 0)
  const core = seedTopic(db, 't-core', 'Core', java, 0)
  const jvm = seedTopic(db, 't-jvm', 'JVM', java, 1)
  const concurrency = seedTopic(db, 't-concurrency', 'Concurrency', java, 2)
  const collections = seedTopic(db, 't-collections', 'Collections', java, 3)
  const spring = seedTopic(db, 't-spring', 'Spring', null, 1)
  const systemDesign = seedTopic(db, 't-system-design', 'System design', null, 2)
  const english = seedTopic(db, 't-english', 'English', null, 3)
  const vocabulary = seedTopic(db, 't-vocabulary', 'Vocabulary', english, 0)
  const grammar = seedTopic(db, 't-grammar', 'Grammar', english, 1)

  seedCard(db, jvm, 'due', 'How is the JVM heap organized?', HEAP_ANSWER, ['memory', 'gc'], ['heap diagram', 'GC flow', 'Metaspace'], 0)
  seedCard(db, jvm, 'known', 'JDK vs JRE vs JVM — what is the difference?', 'JVM runs bytecode; JRE = JVM + standard libraries; JDK = JRE + compiler and tools such as `javac`, `jar` and `jlink`.', ['basics'], [], 1)
  seedCard(db, jvm, 'due', 'How does the GC decide what to collect?', 'Objects not reachable from GC roots (thread stacks, static fields, JNI references) are garbage. Reachability is traced from the roots; cycles are not a problem.', ['gc'], ['reachability'], 2)
  seedCard(db, jvm, 'new', 'What is the String pool?', 'A table of interned strings in the heap; literals are reused, `new String()` creates a separate object unless you call `intern()`.', ['strings'], [], 3)
  seedCard(db, jvm, 'known', 'Stack vs heap memory', 'Each thread has its own stack of frames with locals and references; objects themselves live in the shared heap.', ['memory'], ['stack', 'heap'], 4)
  seedCard(db, jvm, 'new', 'What does the JIT compiler do?', 'Compiles hot bytecode to native code at run time; C1 for fast start-up, C2 for heavy optimisation of long-running code.', ['performance'], [], 5)
  seedCard(db, jvm, 'due', 'Explain the ClassLoader hierarchy', 'Bootstrap → Platform → Application; parent-first delegation, so core classes cannot be replaced by application code.', ['classloading'], ['loaders', 'delegation', 'lookup'], 6)
  seedCard(db, jvm, 'known', 'Can Java have memory leaks?', 'Yes: objects stay reachable by mistake — static collections, listeners, ThreadLocals, caches without eviction.', ['memory'], [], 7)

  seedCard(db, core, 'known', 'equals() and hashCode() contract', 'Equal objects must have equal hash codes; override both or neither.', ['objects'])
  seedCard(db, core, 'learning', 'What does `final` mean on a class, method and variable?', 'Class: cannot be extended. Method: cannot be overridden. Variable: assigned once.', ['basics'])
  seedCard(db, core, 'new', 'Checked vs unchecked exceptions', 'Checked ones must be declared or caught; unchecked (RuntimeException, Error) need not be.', ['exceptions'])
  seedCard(db, core, 'known', 'Why is String immutable?', 'Safe sharing in the pool, thread safety, stable hash codes, and security for class names and paths.', ['strings'])

  seedCard(db, concurrency, 'due', 'What does `volatile` guarantee?', 'Visibility and ordering of reads and writes to that field across threads — not atomicity of compound actions.', ['memory-model'])
  seedCard(db, concurrency, 'due', 'synchronized vs ReentrantLock', 'Both are reentrant mutual exclusion; ReentrantLock adds tryLock, timeouts, fairness and several conditions.', ['locks'])
  seedCard(db, concurrency, 'due', 'What is a deadlock and how do you avoid it?', 'Threads wait on each other forever. Take locks in one global order, use timeouts, keep critical sections small.', ['locks'])
  seedCard(db, concurrency, 'due', 'What are virtual threads?', 'Cheap threads scheduled by the JVM onto a few carrier threads; blocking calls park them instead of an OS thread.', ['loom'])
  seedCard(db, concurrency, 'due', 'ExecutorService: why not new Thread()?', 'A pool reuses threads, bounds concurrency, queues work and gives you Futures and orderly shutdown.', ['executors'])

  seedCard(db, collections, 'known', 'How does HashMap work?', 'An array of buckets indexed by hash; collisions chain in lists that turn into trees past eight entries.', ['map'])
  seedCard(db, collections, 'learning', 'ArrayList vs LinkedList', 'ArrayList: fast random access, amortised O(1) append. LinkedList: O(1) at the ends, slow indexing, more memory.', ['list'])
  seedCard(db, collections, 'new', 'What is ConcurrentHashMap and how is it thread-safe?', 'Lock-free reads and per-bin locking with CAS for writes; no global lock.', ['map', 'concurrency'])

  seedCard(db, spring, 'known', 'What is dependency injection?', 'The container builds beans and passes them their collaborators; prefer constructor injection.', ['core'])
  seedCard(db, spring, 'learning', '@Component vs @Bean', '@Component marks a class for scanning; @Bean is a factory method in a @Configuration class.', ['core'])
  seedCard(db, spring, 'new', 'How does @Transactional work?', 'A proxy opens and commits a transaction around the call; self-invocation bypasses the proxy.', ['data'])
  seedCard(db, spring, 'new', 'Bean scopes', 'singleton (default), prototype, and web scopes: request, session, application, websocket.', ['core'])

  seedCard(db, systemDesign, 'learning', 'Horizontal vs vertical scaling', 'Vertical: a bigger machine. Horizontal: more machines behind a load balancer; needs stateless services.', ['scaling'])
  seedCard(db, systemDesign, 'new', 'What is the CAP theorem?', 'During a network partition a distributed store chooses consistency or availability.', ['distributed'])
  seedCard(db, systemDesign, 'known', 'Cache-aside pattern', 'Read from the cache; on a miss read the database and fill the cache; invalidate on write.', ['caching'])

  const words: Array<[string, string]> = [
    ['ubiquitous', 'present everywhere'],
    ['meticulous', 'very careful about details'],
    ['to mitigate', 'to make less severe'],
    ['ambiguous', 'open to more than one meaning'],
    ['to leverage', 'to use something to maximum advantage'],
    ['tenacious', 'not giving up easily']
  ]
  words.forEach(([word, meaning], i) =>
    seedCard(db, vocabulary, i < 4 ? 'due' : 'new', word, meaning, ['b2'], [], i)
  )

  seedCard(db, grammar, 'known', 'Present perfect vs past simple', 'Present perfect links the past to now (I have lost my keys); past simple is a finished time (I lost them yesterday).', ['tenses'])
  seedCard(db, grammar, 'learning', 'Second vs third conditional', 'Second: unreal present (If I had time, I would go). Third: unreal past (If I had had time, I would have gone).', ['conditionals'])
  seedCard(db, grammar, 'new', 'When do you use "the"?', 'For something specific or already mentioned, unique things, superlatives and some names.', ['articles'])

  // ---- Shared with me
  const springInterview = seedTopic(db, 't-spring-interview', 'Spring interview', null, 0, users.andrii)
  const kafka = seedTopic(db, 't-kafka', 'Kafka basics', null, 1, users.andrii)
  const phrasal = seedTopic(db, 't-phrasal', 'Phrasal verbs B2', null, 0, users.olena)
  db.sharedWithMe.set(springInterview, 'viewer')
  db.sharedWithMe.set(kafka, 'editor')
  db.sharedWithMe.set(phrasal, 'viewer')
  db.topics.get(kafka)!.unseen = true
  db.topics.get(phrasal)!.unseen = true

  seedCard(db, springInterview, 'known', 'What is dependency injection in Spring?', 'The container creates beans and wires their dependencies; prefer constructor injection for required ones.', ['core'], ['container'])
  seedCard(db, springInterview, 'due', '@Component vs @Bean', '@Component marks a class for scanning; @Bean is a factory method in a @Configuration class.', ['core'])
  seedCard(db, springInterview, 'due', 'How does @Transactional work?', 'A proxy opens and commits a transaction around the call; self-invocation bypasses the proxy.', ['data'], ['proxy', 'flow'])
  seedCard(db, springInterview, 'learning', 'Bean scopes', 'singleton (default), prototype, and web scopes: request, session, application, websocket.', ['core'])
  seedCard(db, springInterview, 'new', 'What does Spring Boot auto-configuration do?', 'Registers beans conditionally based on the classpath and properties; your own beans win.', ['boot'])
  seedCard(db, springInterview, 'known', 'Filter vs Interceptor', 'Filters are Servlet-level and run before DispatcherServlet; interceptors run around handler methods.', ['web'], ['chain'])

  seedCard(db, kafka, 'new', 'What is a partition?', 'An ordered, append-only log; the unit of parallelism and ordering in a topic.', ['basics'])
  seedCard(db, kafka, 'new', 'What is a consumer group?', 'Consumers sharing the work of a topic: each partition goes to exactly one member.', ['consumers'])
  seedCard(db, kafka, 'new', 'At-least-once vs exactly-once', 'At-least-once may redeliver after a failure; exactly-once needs idempotent producers and transactions.', ['delivery'])

  seedCard(db, phrasal, 'due', 'to put off', 'to postpone', ['b2'])
  seedCard(db, phrasal, 'due', 'to come up with', 'to think of an idea or plan', ['b2'])
  seedCard(db, phrasal, 'new', 'to look into', 'to investigate', ['b2'])
  seedCard(db, phrasal, 'new', 'to run out of', 'to have none left', ['b2'])

  // ---- Who JVM is shared with (the Share dialog on the mockup)
  db.topics.get(jvm)!.shared = true
  db.sharing.set(jvm, {
    people: [
      { user: users.andrii, role: 'editor' },
      { user: users.olena, role: 'viewer' }
    ],
    linkEnabled: false,
    linkToken: null
  })

  return db
}

export const db: Db = seed()

export function toCard(stored: StoredCard): Card {
  const { srs, due, ...rest } = stored
  return {
    ...rest,
    status: statusOf(srs),
    dueAt: due === null ? null : new Date(due).toISOString()
  }
}

export const isDue = (card: StoredCard, now = Date.now()): boolean => card.due !== null && card.due <= now
