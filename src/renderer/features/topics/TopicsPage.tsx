import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Id } from '@/api/types'
import { useLayoutMode } from '@/app/useLayoutMode'
import { CardModal } from '@/features/cards/CardModal'
import { CardsSection } from '@/features/cards/CardsSection'
import { Button } from '@/ui/Button'
import { anyLayerOpen } from '@/ui/dialogLayer'
import { CloseIcon, MenuIcon, PlusIcon, SearchIcon } from '@/ui/icons'
import { EmptyTopics } from './EmptyTopics'
import { pathTo, type TopicNode } from './tree'
import { TopicHeader } from './TopicHeader'
import styles from './TopicsPage.module.css'
import { TopicTree } from './TopicTree'
import { useTopicsUi } from './topicsUiStore'
import { useMyTopics } from './useTopics'

/**
 * Screen 1, My topics: the topic tree beside the open topic. On a compact or narrow window the
 * tree moves into a drawer that slides over the content (☰ in the header).
 */
export function TopicsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { topicId } = useParams<{ topicId: string }>()
  const mode = useLayoutMode()
  const asDrawer = mode === 'compact' || mode === 'narrow'

  const { tree, isLoading } = useMyTopics()
  const { lastTopicId, setLastTopic, expand } = useTopicsUi()
  const [creatingRoot, setCreatingRoot] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const focusSearchOnOpen = useRef(false)

  const node = topicId && tree ? tree.byId.get(topicId) : undefined
  // Nothing to search before the first topic: no field then, and no query left over.
  const hasTopics = (tree?.roots.length ?? 0) > 0
  const activeQuery = hasTopics ? query : ''

  useEffect(() => {
    if (!node || !tree) return
    setLastTopic(node.topic.id)
    // Opening a topic reveals it in the tree.
    pathTo(tree, node.topic.id)
      .slice(0, -1)
      .forEach((n) => expand(n.topic.id))
  }, [node, tree, setLastTopic, expand])

  useEffect(() => {
    if (!asDrawer) setDrawerOpen(false)
  }, [asDrawer])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog], [role=menu]')) setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  // Ctrl+K (by key position, so it works in any layout) goes to the search, opening the drawer
  // first on a compact or narrow window.
  useEffect(() => {
    if (!hasTopics) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'KeyK' || !e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || anyLayerOpen()) return
      e.preventDefault()
      if (asDrawer && !drawerOpen) {
        focusSearchOnOpen.current = true
        setDrawerOpen(true)
      } else {
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hasTopics, asDrawer, drawerOpen])

  useEffect(() => {
    if (!drawerOpen || !focusSearchOnOpen.current) return
    focusSearchOnOpen.current = false
    searchRef.current?.focus()
  }, [drawerOpen])

  const startCreatingRoot = (): void => {
    setQuery('')
    setCreatingRoot(true)
    if (asDrawer) setDrawerOpen(true)
  }

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape' && query) {
      // The first Escape clears the search; the next one closes the drawer.
      e.preventDefault()
      e.stopPropagation()
      setQuery('')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      panelRef.current?.querySelector<HTMLElement>('[role=treeitem]')?.focus()
    }
  }

  const open = useCallback(
    (id: Id) => {
      navigate(`/topics/${id}`)
      setDrawerOpen(false)
    },
    [navigate]
  )

  const onDeleted = useCallback(
    (deleted: TopicNode) => {
      if (!tree || !topicId) return
      const openIsGone = pathTo(tree, topicId).some((n) => n.topic.id === deleted.topic.id)
      if (openIsGone) navigate(deleted.topic.parentId ? `/topics/${deleted.topic.parentId}` : '/topics', { replace: true })
    },
    [tree, topicId, navigate]
  )

  // /topics, or a topic that no longer exists: go to the last one opened, else the first.
  if (tree && !node) {
    const fallback = (lastTopicId && tree.byId.has(lastTopicId) ? lastTopicId : null) ?? tree.roots[0]?.topic.id
    if (fallback && fallback !== topicId) return <Navigate to={`/topics/${fallback}`} replace />
  }

  const panel = (
    <aside
      ref={panelRef}
      className={asDrawer ? `${styles.panel} ${styles.drawer}` : styles.panel}
      aria-label={t('nav.myTopics')}
    >
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t('nav.myTopics')}</h2>
        <Button
          iconOnly
          icon={<PlusIcon size={18} />}
          aria-label={t('topics.new')}
          title={t('topics.new')}
          onClick={startCreatingRoot}
        />
        {asDrawer && (
          <Button
            variant="ghost"
            iconOnly
            icon={<CloseIcon size={18} />}
            aria-label={t('common.close')}
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </div>

      {hasTopics && (
        <label className={styles.search}>
          <SearchIcon size={15} />
          <input
            ref={searchRef}
            value={query}
            placeholder={t('topics.search')}
            aria-label={t('topics.search')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
          />
          <kbd className={styles.shortcut}>{t('topics.searchShortcut')}</kbd>
        </label>
      )}

      <div className={styles.panelBody}>
        {tree && (
          <TopicTree
            tree={tree}
            selectedId={node?.topic.id ?? null}
            onSelect={open}
            onDeleted={onDeleted}
            creatingRoot={creatingRoot}
            onCreatingRootDone={() => setCreatingRoot(false)}
            query={activeQuery}
            onClearQuery={() => setQuery('')}
          />
        )}        {isLoading && <div className={styles.skeleton} aria-hidden="true" />}
      </div>

    </aside>
  )

  return (
    <div className={styles.page}>
      {tree && <CardModal tree={tree} />}
      {asDrawer ? (
        drawerOpen && (
          <div
            className={`${styles.scrim} ${mode === 'compact' ? styles.scrimBesideRail : ''}`}
            onMouseDown={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
            {panel}
          </div>
        )
      ) : (
        panel
      )}

      <section className={styles.content}>
        {asDrawer && (
          <div className={styles.drawerBar}>
            <Button
              variant="ghost"
              iconOnly
              icon={<MenuIcon size={20} />}
              aria-label={t('topics.openTree')}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            />
          </div>
        )}
        {tree && node ? (
          <>
            <TopicHeader tree={tree} node={node} onNavigate={open} />
            <CardsSection key={node.topic.id} tree={tree} node={node} />
          </>
        ) : tree && !hasTopics ? (
          <EmptyTopics onCreate={startCreatingRoot} />
        ) : (
          tree && (
            <div className={styles.pick}>
              <p>{t('topics.pick')}</p>
            </div>
          )
        )}
      </section>
    </div>
  )
}
