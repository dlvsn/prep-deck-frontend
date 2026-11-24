import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import type { Card, CardDraft, CardImage, CardPatch, Id } from '@/api/types'
import { toastError } from '@/ui/toast'
import { writeDraft, type CardDraftSnapshot, type DraftRef } from './drafts'

export const cardKeys = {
  all: ['cards'] as const,
  topic: (topicId: Id) => ['cards', 'topic', topicId] as const,
  tags: ['cards', 'tags'] as const
}

export function useTopicCards(topicId: Id | null) {
  return useQuery({
    queryKey: cardKeys.topic(topicId ?? ''),
    queryFn: () => api.cards.list(topicId!),
    enabled: topicId !== null
  })
}

export function useCardTags() {
  return useQuery({ queryKey: cardKeys.tags, queryFn: () => api.cards.tags(), staleTime: 60_000 })
}

const PENDING = 'pending:'
let pendingSeq = 0

/** A card shown before the server has answered; it cannot be opened yet. */
export const isPendingCard = (card: Card): boolean => card.id.startsWith(PENDING)

/**
 * The React key a card keeps for its whole life: a card created optimistically keeps the key of
 * its stand-in, so it does not mount (and rise) a second time when the server's copy replaces it.
 */
const stableKeys = new Map<Id, string>()
export const cardKey = (card: Card): string => stableKeys.get(card.id) ?? card.id

type Lists = Array<[readonly unknown[], Card[] | undefined]>

/** Takes the cached lists of the given topics, to restore them if the server refuses. */
function snapshot(client: QueryClient, topicIds: Id[]): Lists {
  return [...new Set(topicIds)].map((id): Lists[number] => [cardKeys.topic(id), client.getQueryData<Card[]>(cardKeys.topic(id))])
}

function restore(client: QueryClient, lists: Lists | undefined): void {
  lists?.forEach(([key, data]) => client.setQueryData(key, data))
}

function editList(client: QueryClient, topicId: Id, edit: (cards: Card[]) => Card[]): void {
  const current = client.getQueryData<Card[]>(cardKeys.topic(topicId))
  if (current) client.setQueryData<Card[]>(cardKeys.topic(topicId), edit(current))
}

/**
 * The editor clears its draft as it saves (so Save & new opens clean); if the server then
 * refuses, the draft is written back and offered again next time.
 */
export interface DraftBackup {
  ref: DraftRef
  snapshot: CardDraftSnapshot
}

export interface CreateCardVars {
  topicId: Id
  draft: CardDraft
  /** The pictures behind draft.imageIds, for the stand-in card. */
  images: CardImage[]
  draftBackup?: DraftBackup
}

export interface UpdateCardVars {
  card: Card
  patch: CardPatch
  /** The pictures behind patch.imageIds, when it carries them. */
  images?: CardImage[]
  draftBackup?: DraftBackup
}

/**
 * Every change to cards. Create, edit, move and delete show at once and are rolled back with a
 * toast if the server refuses; duplicate waits for the server, since the copy opens in the
 * editor. Each refreshes the topic counters in the tree and the tag suggestions afterwards.
 *
 * The cache work sits on the mutation itself, not on `mutate()` calls, so it still runs after the
 * editor that started it has closed.
 */
export function useCardMutations() {
  const client = useQueryClient()
  const refreshAround = (): void => {
    void client.invalidateQueries({ queryKey: ['topics'] })
    void client.invalidateQueries({ queryKey: cardKeys.tags })
  }

  const create = useMutation({
    mutationFn: ({ topicId, draft }: CreateCardVars) => api.cards.create(topicId, draft),
    onMutate: ({ topicId, draft, images }) => {
      const lists = snapshot(client, [topicId])
      const now = new Date().toISOString()
      const stand: Card = {
        id: `${PENDING}${++pendingSeq}`,
        topicId,
        question: draft.question,
        answer: draft.answer,
        tags: draft.tags,
        images,
        status: 'new',
        dueAt: null,
        createdAt: now,
        updatedAt: now
      }
      editList(client, topicId, (cards) => [stand, ...cards])
      return { lists, standId: stand.id }
    },
    onError: (error, { draftBackup }, context) => {
      restore(client, context?.lists)
      if (draftBackup) writeDraft(draftBackup.ref, draftBackup.snapshot)
      toastError(error)
    },
    onSuccess: (card, { topicId }, context) => {
      if (context) stableKeys.set(card.id, context.standId)
      editList(client, topicId, (cards) => cards.map((c) => (c.id === context?.standId ? card : c)))
    },
    onSettled: refreshAround
  })

  const update = useMutation({
    mutationFn: ({ card, patch }: UpdateCardVars) => api.cards.update(card.id, patch),
    onMutate: ({ card, patch, images }) => {
      const target = patch.topicId ?? card.topicId
      const lists = snapshot(client, [card.topicId, target])
      const changed: Card = {
        ...card,
        question: patch.question ?? card.question,
        answer: patch.answer ?? card.answer,
        tags: patch.tags ?? card.tags,
        images: images ?? card.images,
        topicId: target,
        updatedAt: new Date().toISOString()
      }
      if (target === card.topicId) {
        editList(client, target, (cards) => cards.map((c) => (c.id === card.id ? changed : c)))
      } else {
        editList(client, card.topicId, (cards) => cards.filter((c) => c.id !== card.id))
        editList(client, target, (cards) => [changed, ...cards.filter((c) => c.id !== card.id)])
      }
      return { lists }
    },
    onError: (error, { draftBackup }, context) => {
      restore(client, context?.lists)
      if (draftBackup) writeDraft(draftBackup.ref, draftBackup.snapshot)
      toastError(error)
    },
    onSuccess: (saved) => {
      editList(client, saved.topicId, (cards) => cards.map((c) => (c.id === saved.id ? saved : c)))
    },
    onSettled: refreshAround
  })

  const remove = useMutation({
    mutationFn: (card: Card) => api.cards.remove(card.id),
    onMutate: (card) => {
      const lists = snapshot(client, [card.topicId])
      editList(client, card.topicId, (cards) => cards.filter((c) => c.id !== card.id))
      return { lists }
    },
    onError: (error, _card, context) => {
      restore(client, context?.lists)
      toastError(error)
    },
    onSettled: refreshAround
  })

  const duplicate = useMutation({
    mutationFn: ({ card, question }: { card: Card; question: string }) => api.cards.duplicate(card.id, question),
    onSuccess: (copy) => editList(client, copy.topicId, (cards) => [copy, ...cards]),
    onError: toastError,
    onSettled: refreshAround
  })

  return { create, update, remove, duplicate }
}
