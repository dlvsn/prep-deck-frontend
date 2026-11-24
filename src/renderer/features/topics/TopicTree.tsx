import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@/api/types'
import { useCardModal } from '@/features/cards/cardModalStore'
import { ChevronRightIcon, FolderPlusIcon, MoreIcon, MoveIcon, PencilIcon, PlusIcon, ShareIcon, SharedIcon, TrashIcon } from '@/ui/icons'
import { Menu, type MenuItem } from '@/ui/Menu'
import { DeleteTopicDialog } from './DeleteTopicDialog'
import { MoveTopicDialog } from './MoveTopicDialog'
import { can } from './permissions'
import { dropTarget, visibleRows, type DropPosition, type TopicNode, type TopicTree as Tree } from './tree'
import styles from './TopicTree.module.css'
import { useTopicsUi } from './topicsUiStore'
import { useTopicMutations } from './useTopics'

interface TopicTreeProps {
  tree: Tree
  selectedId: Id | null
  onSelect(id: Id): void
  /** A topic was deleted; the page decides where to go if it was the open one. */
  onDeleted(node: TopicNode): void
  /** Set by the page's "+" button: show the inline field for a new root topic. */
  creatingRoot: boolean
  onCreatingRootDone(): void
}

/** The Share dialog arrives with stage 6; until then the menu item is shown disabled. */
const SHARE_DIALOG_READY = false

type Editing = { kind: 'rename'; id: Id } | { kind: 'create'; parentId: Id | null } | null

/**
 * The topic tree of My topics: expand and collapse, inline rename and create, a context menu
 * (right click, "⋯", Shift+F10), drag and drop to reorder and nest, and full keyboard control.
 */
export function TopicTree({ tree, selectedId, onSelect, onDeleted, creatingRoot, onCreatingRootDone }: TopicTreeProps) {
  const { t } = useTranslation()
  const { expanded: expandedList, toggle, expand, collapse } = useTopicsUi()
  const expanded = useMemo(() => new Set(expandedList), [expandedList])
  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded])
  const { create, rename, move } = useTopicMutations()

  const [focusedId, setFocusedId] = useState<Id | null>(selectedId)
  const [editing, setEditing] = useState<Editing>(null)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; node: TopicNode } | null>(null)
  const [deleting, setDeleting] = useState<TopicNode | null>(null)
  const [moving, setMoving] = useState<TopicNode | null>(null)
  const [drag, setDrag] = useState<{ id: Id; over: Id | null; position: DropPosition | null } | null>(null)

  const rowRefs = useRef(new Map<Id, HTMLDivElement>())
  // When each visible row first appeared. Rows that appear after the first render (a branch just
  // expanded, a topic just created) slide in for a moment; the initial ones and re-renders do not.
  const mounted = useRef(false)
  const appearedAt = useRef(new Map<Id, number>())
  useEffect(() => {
    mounted.current = true
  }, [])
  useEffect(() => {
    const visible = new Set(rows.map((r) => r.topic.id))
    for (const id of appearedAt.current.keys()) if (!visible.has(id)) appearedAt.current.delete(id)
  }, [rows])
  const now = performance.now()
  for (const row of rows) {
    if (!appearedAt.current.has(row.topic.id)) appearedAt.current.set(row.topic.id, mounted.current ? now : -Infinity)
  }
  const isEntering = (id: Id): boolean => now - (appearedAt.current.get(id) ?? -Infinity) < 300

  useEffect(() => {
    if (creatingRoot) setEditing({ kind: 'create', parentId: null })
  }, [creatingRoot])

  // Keep a focusable row even after the focused one disappears (collapsed or deleted).
  const tabStop = rows.some((r) => r.topic.id === focusedId) ? focusedId : (selectedId ?? rows[0]?.topic.id ?? null)

  // Focus moves at once when the row is on screen; a row that is not there yet (a topic still being
  // created, a branch about to expand) takes it on the first render that shows it. No
  // requestAnimationFrame: it is paused while the window is in the background.
  const pendingFocus = useRef<Id | null>(null)
  const focusRow = useCallback((id: Id | null | undefined) => {
    if (!id) return
    setFocusedId(id)
    const el = rowRefs.current.get(id)
    if (el) {
      el.focus()
      pendingFocus.current = null
    } else {
      pendingFocus.current = id
    }
  }, [])
  useLayoutEffect(() => {
    const id = pendingFocus.current
    const el = id ? rowRefs.current.get(id) : undefined
    if (el) {
      el.focus()
      pendingFocus.current = null
    }
  })

  const finishEditing = (value: string | null): void => {
    const current = editing
    setEditing(null)
    if (current?.kind === 'create' && current.parentId === null) onCreatingRootDone()
    const title = value?.trim()
    if (!current) return
    if (current.kind === 'rename') {
      if (title && title !== tree.byId.get(current.id)?.topic.title) rename.mutate({ id: current.id, title })
      focusRow(current.id)
    } else if (!title) {
      focusRow(current.parentId ?? selectedId ?? rows[0]?.topic.id)
    } else {
      create.mutate(
        { title, parentId: current.parentId },
        {
          onSuccess: (topic) => {
            onSelect(topic.id)
            focusRow(topic.id)
          }
        }
      )
    }
  }

  const startCreateChild = (node: TopicNode): void => {
    expand(node.topic.id)
    setEditing({ kind: 'create', parentId: node.topic.id })
  }

  const moveAmongSiblings = (node: TopicNode, delta: -1 | 1): void => {
    const siblings = node.topic.parentId ? (tree.byId.get(node.topic.parentId)?.children ?? []) : tree.roots
    const index = siblings.indexOf(node)
    const order = index + delta
    if (order < 0 || order >= siblings.length || !can('move', node.topic)) return
    move.mutate({ id: node.topic.id, parentId: node.topic.parentId, order })
    focusRow(node.topic.id)
  }

  // Actions the role does not allow are left out, not shown disabled.
  const menuItems = (node: TopicNode): MenuItem[] => {
    const items: Array<MenuItem & { allowed: boolean }> = [
      {
        id: 'newCard',
        label: t('cards.new'),
        icon: <PlusIcon size={16} />,
        allowed: can('edit', node.topic),
        onSelect: () => useCardModal.getState().openCreate(node.topic.id)
      },
      {
        id: 'rename',
        label: t('topics.rename'),
        icon: <PencilIcon size={16} />,
        allowed: can('edit', node.topic),
        onSelect: () => setEditing({ kind: 'rename', id: node.topic.id })
      },
      {
        id: 'subtopic',
        label: t('topics.newSubtopic'),
        icon: <FolderPlusIcon size={16} />,
        allowed: can('edit', node.topic),
        onSelect: () => startCreateChild(node)
      },
      {
        id: 'move',
        label: t('topics.moveTo'),
        icon: <MoveIcon size={16} />,
        allowed: can('move', node.topic),
        onSelect: () => setMoving(node)
      },
      {
        id: 'share',
        label: t('topics.share'),
        icon: <ShareIcon size={16} />,
        allowed: can('share', node.topic),
        disabled: !SHARE_DIALOG_READY,
        onSelect: () => undefined
      },
      {
        id: 'delete',
        label: t('topics.delete'),
        icon: <TrashIcon size={16} />,
        danger: true,
        allowed: can('delete', node.topic),
        onSelect: () => setDeleting(node)
      }
    ]
    return items.filter((item) => item.allowed)
  }

  // A viewer may have nothing to pick from: then no menu opens at all.
  const openMenu = (at: { x: number; y: number }, node: TopicNode): void => {
    if (menuItems(node).length > 0) setMenu({ at, node })
  }

  const openMenuAtRow = (node: TopicNode): void => {
    const rect = rowRefs.current.get(node.topic.id)?.getBoundingClientRect()
    if (rect) openMenu({ x: rect.right - 40, y: rect.bottom - 4 }, node)
  }

  // Dismissed: focus goes back to the row. Picked: the action (an inline field, a dialog) takes it.
  const closeMenu = useCallback(
    (selected?: boolean) => {
      setMenu((current) => {
        if (current && !selected) focusRow(current.node.topic.id)
        return null
      })
    },
    [focusRow]
  )

  const onRowKeyDown = (e: KeyboardEvent, node: TopicNode, index: number): void => {
    if (editing) return
    const id = node.topic.id
    const isOpen = expanded.has(id)
    const hasChildren = node.children.length > 0
    switch (e.key) {
      case 'ArrowDown':
        if (e.ctrlKey) moveAmongSiblings(node, 1)
        else focusRow(rows[index + 1]?.topic.id)
        break
      case 'ArrowUp':
        if (e.ctrlKey) moveAmongSiblings(node, -1)
        else focusRow(rows[index - 1]?.topic.id)
        break
      case 'ArrowRight':
        if (hasChildren && !isOpen) expand(id)
        else if (hasChildren) focusRow(node.children[0].topic.id)
        break
      case 'ArrowLeft':
        if (hasChildren && isOpen) collapse(id)
        else focusRow(node.topic.parentId)
        break
      case 'Home':
        focusRow(rows[0]?.topic.id)
        break
      case 'End':
        focusRow(rows[rows.length - 1]?.topic.id)
        break
      case 'Enter':
      case ' ':
        onSelect(id)
        break
      case 'F2':
        if (can('edit', node.topic)) setEditing({ kind: 'rename', id })
        break
      case 'Delete':
        if (can('delete', node.topic)) setDeleting(node)
        break
      case 'ContextMenu':
        openMenuAtRow(node)
        break
      case 'F10':
        if (!e.shiftKey) return
        openMenuAtRow(node)
        break
      default:
        return
    }
    e.preventDefault()
  }

  // ---------------------------------------------------------------- drag and drop

  const positionFor = (e: DragEvent, node: TopicNode): DropPosition => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    if (y < 0.28) return 'before'
    if (y > 0.72) return 'after'
    return can('edit', node.topic) ? 'inside' : y < 0.5 ? 'before' : 'after'
  }

  const onDragOver = (e: DragEvent, node: TopicNode): void => {
    if (!drag) return
    const position = positionFor(e, node)
    if (!dropTarget(tree, drag.id, node, position)) {
      if (drag.over !== null) setDrag({ ...drag, over: null, position: null })
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (drag.over !== node.topic.id || drag.position !== position) {
      setDrag({ ...drag, over: node.topic.id, position })
    }
  }

  const onDrop = (e: DragEvent, node: TopicNode): void => {
    e.preventDefault()
    if (!drag) return
    const position = positionFor(e, node)
    const target = dropTarget(tree, drag.id, node, position)
    setDrag(null)
    if (!target) return
    if (position === 'inside') expand(node.topic.id)
    move.mutate({ id: drag.id, ...target })
  }

  /** Dropped below the last row: to the end of the top level. */
  const onDropOnEmpty = (e: DragEvent): void => {
    e.preventDefault()
    if (!drag) return
    const dragged = tree.byId.get(drag.id)
    setDrag(null)
    if (!dragged || !can('move', dragged.topic)) return
    const order = tree.roots.filter((r) => r.topic.id !== drag.id).length
    move.mutate({ id: drag.id, parentId: null, order })
  }

  // ---------------------------------------------------------------- rendering

  const renderCreateRow = (parentId: Id | null, depth: number) =>
    editing?.kind === 'create' && editing.parentId === parentId ? (
      <div className={styles.row} style={{ paddingLeft: indent(depth) }} key={`new-${parentId ?? 'root'}`}>
        <span className={styles.chevronSpace} />
        <InlineInput placeholder={t('topics.namePlaceholder')} initial="" onDone={finishEditing} label={t('topics.new')} />
      </div>
    ) : null

  const out: ReactElement[] = []
  rows.forEach((node, index) => {
    const { topic } = node
    const id = topic.id
    const isOpen = expanded.has(id)
    const hasChildren = node.children.length > 0
    const due = hasChildren && !isOpen ? node.totalDue : topic.dueCount
    const isRenaming = editing?.kind === 'rename' && editing.id === id
    const dropClass =
      drag?.over === id
        ? drag.position === 'before'
          ? styles.dropBefore
          : drag.position === 'after'
            ? styles.dropAfter
            : styles.dropInside
        : ''

    out.push(
      <div
        key={id}
        ref={(el) => {
          if (el) rowRefs.current.set(id, el)
          else rowRefs.current.delete(id)
        }}
        role="treeitem"
        aria-level={node.depth + 1}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={id === selectedId}
        tabIndex={id === tabStop ? 0 : -1}
        className={[
          styles.row,
          id === selectedId ? styles.selected : '',
          node.depth === 0 ? styles.root : '',
          isEntering(id) ? styles.enter : '',
          drag?.id === id ? styles.dragging : '',
          dropClass
        ].join(' ')}
        style={{ paddingLeft: indent(node.depth) }}
        draggable={!isRenaming && can('move', topic)}
        onClick={() => {
          setFocusedId(id)
          onSelect(id)
        }}
        onDoubleClick={(e) => {
          if (hasChildren && !(e.target as HTMLElement).closest('button')) toggle(id)
        }}
        onFocus={() => setFocusedId(id)}
        onKeyDown={(e) => onRowKeyDown(e, node, index)}
        onContextMenu={(e) => {
          e.preventDefault()
          setFocusedId(id)
          openMenu({ x: e.clientX, y: e.clientY }, node)
        }}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', topic.title)
          setDrag({ id, over: null, position: null })
        }}
        onDragOver={(e) => onDragOver(e, node)}
        onDragLeave={(e) => {
          if (drag && !e.currentTarget.contains(e.relatedTarget as Node)) setDrag({ ...drag, over: null, position: null })
        }}
        onDrop={(e) => onDrop(e, node)}
        onDragEnd={() => setDrag(null)}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation()
              toggle(id)
            }}
          >
            <ChevronRightIcon size={16} />
          </button>
        ) : (
          <span className={styles.chevronSpace} />
        )}

        {isRenaming ? (
          <InlineInput initial={topic.title} onDone={finishEditing} label={t('topics.rename')} />
        ) : (
          <span className={styles.title} title={topic.title}>
            {topic.unseen && <span className={styles.unseenDot} aria-hidden="true" />}
            {topic.title}
          </span>
        )}

        {!isRenaming && (
          <span className={styles.meta}>
            {topic.shared && (
              <span className={styles.sharedIcon} title={t('topics.sharedHint')} aria-label={t('topics.sharedHint')}>
                <SharedIcon size={14} />
              </span>
            )}
            {due > 0 && (
              <span className={styles.due} aria-label={t('practice.due', { count: due })}>
                {due}
              </span>
            )}
            <span className={styles.count} aria-label={t('cards.count', { count: node.totalCards })}>
              {node.totalCards}
            </span>
            <button
              type="button"
              tabIndex={-1}
              className={styles.more}
              aria-label={t('topics.actions')}
              onClick={(e) => {
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setFocusedId(id)
                openMenu({ x: rect.left, y: rect.bottom + 4 }, node)
              }}
            >
              <MoreIcon size={16} />
            </button>
          </span>
        )}
      </div>
    )

    // The field for a new subtopic sits after this topic's last visible descendant.
    const next = rows[index + 1]
    let ancestor: TopicNode | undefined = node
    while (ancestor && (!next || next.depth <= ancestor.depth)) {
      if (expanded.has(ancestor.topic.id) || ancestor === node) {
        const row = renderCreateRow(ancestor.topic.id, ancestor.depth + 1)
        if (row) out.push(row)
      }
      ancestor = ancestor.topic.parentId ? tree.byId.get(ancestor.topic.parentId) : undefined
    }
  })
  const rootCreate = renderCreateRow(null, 0)
  if (rootCreate) out.push(rootCreate)

  return (
    <>
      <div className={styles.tree} role="tree" aria-label={t('nav.myTopics')}>
        {out}
        <div
          className={`${styles.dropTail} ${drag ? styles.dropTailActive : ''}`}
          onDragOver={(e) => drag && e.preventDefault()}
          onDrop={onDropOnEmpty}
        />
      </div>

      <Menu at={menu?.at ?? null} items={menu ? menuItems(menu.node) : []} label={t('topics.actions')} onClose={closeMenu} />

      <DeleteTopicDialog
        node={deleting}
        onClose={() => {
          if (deleting) focusRow(deleting.topic.parentId ?? rows[0]?.topic.id)
          setDeleting(null)
        }}
        onDeleted={onDeleted}
      />
      <MoveTopicDialog
        tree={tree}
        node={moving}
        onClose={() => {
          if (moving) focusRow(moving.topic.id)
          setMoving(null)
        }}
      />
    </>
  )
}

const indent = (depth: number): number => 8 + depth * 22

function InlineInput({
  initial,
  placeholder,
  label,
  onDone
}: {
  initial: string
  placeholder?: string
  label: string
  onDone(value: string | null): void
}) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  const finish = (result: string | null): void => {
    if (done.current) return
    done.current = true
    onDone(result)
  }
  return (
    <input
      className={styles.input}
      value={value}
      placeholder={placeholder}
      aria-label={label}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(value)
        if (e.key === 'Escape') finish(null)
      }}
      onBlur={() => finish(value)}
    />
  )
}
