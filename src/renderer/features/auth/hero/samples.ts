/**
 * The example cards the login pictures show. They stand for a user's own cards, which stay in the
 * language they were written in, so they are not translated; only the app's labels around them are.
 */
export const SAMPLE = {
  heap: 'How is the JVM heap organized?',
  beans: '@Component vs @Bean',
  tenses: 'Present Perfect vs Past Simple',
  gcQuestion: 'How does the GC decide what to collect?',
  gcTag: '#gc',
  gcAnswerStart: 'Objects that are not reachable from ',
  gcAnswerTerm: 'GC roots',
  gcAnswerEnd: ' — thread stacks, static fields, JNI references — are garbage.'
} as const

export type SampleStatus = 'new' | 'learning' | 'known'

/** The deck picture E deals through, top card first. `id` is the card's React key. */
export const DECK: ReadonlyArray<{ id: string; question: string; topic: string; status: SampleStatus }> = [
  { id: 'classloader', question: 'Explain the ClassLoader hierarchy', topic: 'Java / JVM', status: 'learning' },
  { id: 'tenses', question: 'Present Perfect vs Past Simple', topic: 'English / Grammar', status: 'new' },
  { id: 'transactional', question: 'How does @Transactional work?', topic: 'Spring', status: 'known' },
  { id: 'cap', question: 'CAP theorem in one sentence', topic: 'System design', status: 'learning' },
  { id: 'race', question: 'What is a race condition?', topic: 'Java / Concurrency', status: 'new' },
  { id: 'look-up-to', question: 'Phrasal verb: «look up to»', topic: 'English / Vocabulary', status: 'known' }
]
