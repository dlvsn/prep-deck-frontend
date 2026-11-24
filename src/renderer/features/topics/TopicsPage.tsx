import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { Id } from '@/api/types'
import { useLayoutMode } from '@/app/useLayoutMode'
import { CardModal } from '@/features/cards/CardModal'
import { CardsSection } from '@/features/cards/CardsSection'
import { Button } from '@/ui/Button'
import { CloseIcon, MenuIcon, PlusIcon } from '@/ui/icons'
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

  const node = topicId && tree ? tree.byId.get(topicId) : undefined

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
    <aside className={asDrawer ? `${styles.panel} ${styles.drawer}` : styles.panel} aria-label={t('nav.myTopics')}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>{t('nav.myTopics')}</h2>
        <Button
          iconOnly
          icon={<PlusIcon size={18} />}
          aria-label={t('topics.new')}
          title={t('topics.new')}
          onClick={() => setCreatingRoot(true)}
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

      <div className={styles.panelBody}>
        {tree && (
          <TopicTree
            tree={tree}
            selectedId={node?.topic.id ?? null}
            onSelect={open}
            onDeleted={onDeleted}
            creatingRoot={creatingRoot}
            onCreatingRootDone={() => setCreatingRoot(false)}
          />
        )}
        {tree && tree.roots.length === 0 && !creatingRoot && (
          <div className={styles.treeEmpty}>
            <p>{t('topics.empty')}</p>
            <Button variant="primary" icon={<PlusIcon size={16} />} onClick={() => setCreatingRoot(true)}>
              {t('topics.new')}
            </Button>
          </div>
        )}
        {isLoading && <div className={styles.skeleton} aria-hidden="true" />}
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
