import { useTranslation } from 'react-i18next'
import type { TopicNode, TopicTree } from '@/features/topics/tree'
import { CheckIcon } from '@/ui/icons'
import { isCovered, isMixed, toggle, type Scope } from './scope'
import styles from './ScopePicker.module.css'

interface ScopePickerProps {
  tree: TopicTree
  /** The top of the tree being shared; it and everything below it can be picked. */
  root: TopicNode
  scope: Scope
  onChange(scope: Scope): void
  /** Editing someone's topics: drawn with the accent, so it is clear the list is theirs. */
  active: boolean
  label: string
}

/**
 * The topics of one tree with a box each. Ticking a topic takes its whole subtree, subtopics added
 * later included, and its subtopics show as included; a topic with only some of its subtopics
 * picked shows a dash.
 */
export function ScopePicker({ tree, root, scope, onChange, active, label }: ScopePickerProps) {
  const { t } = useTranslation()
  const rows: TopicNode[] = []
  const walk = (node: TopicNode): void => {
    rows.push(node)
    node.children.forEach(walk)
  }
  walk(root)

  return (
    <div className={active ? `${styles.picker} ${styles.active}` : styles.picker} role="group" aria-label={label}>
      {rows.map((node) => {
        const covered = isCovered(tree, scope, node.topic.id)
        const own = scope.includes(node.topic.id)
        const implied = covered && !own
        const mixed = isMixed(tree, scope, node)
        const boxClass = [styles.box, own ? styles.boxOn : '', implied ? styles.boxImplied : '', mixed ? styles.boxMixed : ''].join(' ')
        return (
          <button
            key={node.topic.id}
            type="button"
            role="checkbox"
            aria-checked={mixed ? 'mixed' : covered}
            className={`${styles.row} ${own ? styles.rowOn : ''} ${node === root ? styles.rowRoot : ''}`}
            style={{ paddingLeft: 10 + (node.depth - root.depth) * 22 }}
            onClick={() => onChange(toggle(tree, scope, node))}
          >
            <span className={boxClass} aria-hidden="true">
              {covered ? <CheckIcon size={12} strokeWidth={3} /> : mixed ? <span className={styles.dash} /> : null}
            </span>
            <span className={implied ? `${styles.name} ${styles.nameImplied}` : styles.name} title={node.topic.title}>
              {node.topic.title}
            </span>
            {implied && <span className={styles.included}>{t('share.included')}</span>}
            <span className={styles.count}>{t('cards.count', { count: node.totalCards })}</span>
          </button>
        )
      })}
    </div>
  )
}
