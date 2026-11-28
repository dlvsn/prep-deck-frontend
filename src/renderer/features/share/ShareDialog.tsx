import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id, PendingInvite, ShareMember, SharedRole, TopicSharing } from '@/api/types'
import { useSession } from '@/app/session'
import { pathTo, type TopicNode, type TopicTree } from '@/features/topics/tree'
import { Button } from '@/ui/Button'
import { ChevronDownIcon, CopyIcon, FolderIcon, LinkIcon, UserMinusIcon } from '@/ui/icons'
import { Menu, type MenuItem } from '@/ui/Menu'
import { Modal } from '@/ui/Modal'
import { errorText, toastError, useToasts } from '@/ui/toast'
import { relativeTime } from './relativeTime'
import { isCovered, ordered, sameScope, scopeCards, type Scope } from './scope'
import { ScopePicker } from './ScopePicker'
import styles from './ShareDialog.module.css'
import { useShareDialog } from './shareDialogStore'
import { useSharing, useSharingMutations } from './useSharing'

/**
 * The roles an owner could hand out, in the order the menus show them. Only viewing can be given
 * today; editing is shown as coming, so nobody looks for it elsewhere.
 */
const ROLES: Array<{ role: SharedRole; ready: boolean }> = [
  { role: 'viewer', ready: true },
  { role: 'editor', ready: false }
]

/** Screen 5: who can see the tree the topic belongs to, and how they get in. */
export function ShareDialog({ tree }: { tree: TopicTree }) {
  const topicId = useShareDialog((s) => s.topicId)
  const close = useShareDialog((s) => s.close)
  const node = topicId ? tree.byId.get(topicId) : undefined
  if (!node) return null
  return <ShareDialogBody key={node.topic.id} tree={tree} node={node} onClose={close} />
}

type Confirm = 'reset' | 'removeLink' | null

function ShareDialogBody({ tree, node, onClose }: { tree: TopicTree; node: TopicNode; onClose(): void }) {
  const { t, i18n } = useTranslation()
  const me = useSession((s) => s.user)
  const sharing = useSharing(node.topic.id)
  const mutations = useSharingMutations(node.topic.id)
  const root = pathTo(tree, node.topic.id)[0]
  const toast = (message: string): void => useToasts.getState().show(message)

  const [inviteScope, setInviteScope] = useState<Scope>([node.topic.id])
  const [editing, setEditing] = useState<{ member: ShareMember; scope: Scope } | null>(null)
  const [login, setLogin] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; items: MenuItem[]; label: string } | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const scope = editing ? editing.scope : inviteScope
  const setScope = (next: Scope): void => (editing ? setEditing({ ...editing, scope: next }) : setInviteScope(next))
  const empty = scope.length === 0

  const scopeLabel = (ids: Id[]): string =>
    ordered(tree, ids)
      .map((n) => (n.children.length > 0 ? t('share.allSubtopics', { title: n.topic.title }) : n.topic.title))
      .join(', ')

  const roleItems = (current: SharedRole, onPick: (role: SharedRole) => void): MenuItem[] =>
    ROLES.map(({ role, ready }) => ({
      id: role,
      label: t(role === 'viewer' ? 'share.canView' : 'share.canEdit'),
      description: t(role === 'viewer' ? 'share.viewDesc' : 'share.editDesc'),
      badge: ready ? undefined : t('share.soon'),
      disabled: !ready,
      checked: role === current,
      onSelect: () => onPick(role)
    }))

  const openMenuBelow = (button: HTMLElement, items: MenuItem[], label: string): void => {
    const rect = button.getBoundingClientRect()
    setMenu({ at: { x: rect.left, y: rect.bottom + 4 }, items, label })
  }

  // ---------------------------------------------------------------- invitations

  const submitInvite = (e: FormEvent): void => {
    e.preventDefault()
    const value = login.trim()
    if (!value || empty) return
    mutations.invite.mutate(
      { login: value, topicIds: scope },
      {
        onSuccess: () => {
          toast(t('share.toast.invited', { login: value }))
          setLogin('')
          setInviteError(null)
        },
        onError: (error) => setInviteError(errorText(error))
      }
    )
  }

  const revoke = (invite: PendingInvite): void =>
    mutations.revokeInvite.mutate(invite.id, { onSuccess: () => toast(t('share.toast.revoked')) })

  // ---------------------------------------------------------------- people

  const memberMenu = (member: ShareMember): MenuItem[] => [
    // One role can be given today, so picking it changes nothing.
    ...roleItems(member.role, () => undefined),
    {
      id: 'topics',
      label: t('share.changeTopics'),
      icon: <FolderIcon size={16} />,
      separatorBefore: true,
      onSelect: () => setEditing({ member, scope: member.topicIds })
    },
    {
      id: 'remove',
      label: t('share.removeAccess'),
      icon: <UserMinusIcon size={16} />,
      danger: true,
      onSelect: () => mutations.removeMember.mutate(member.user.id, { onSuccess: () => toast(t('share.toast.removed')) })
    }
  ]

  const saveTopics = (): void => {
    if (!editing || empty) return
    mutations.changeTopics.mutate(
      { userId: editing.member.user.id, topicIds: editing.scope },
      {
        onSuccess: () => {
          toast(t('share.toast.topicsSaved'))
          setEditing(null)
        }
      }
    )
  }

  // ---------------------------------------------------------------- the link

  const toggleLink = (link: TopicSharing['link']): void => {
    const enabled = !link.enabled
    // A link made just now opens what is ticked above; one that exists keeps its topics.
    const topicIds = enabled && link.topicIds.length === 0 && !empty ? scope : undefined
    mutations.setLink.mutate(
      { enabled, topicIds },
      { onSuccess: () => toast(t(enabled ? 'share.toast.linkOn' : 'share.toast.linkOff')) }
    )
  }

  const copyLink = (url: string): void => {
    navigator.clipboard.writeText(url).then(() => toast(t('share.toast.copied')), toastError)
  }

  const doConfirm = (): void => {
    const which = confirm
    setConfirm(null)
    if (which === 'reset') mutations.resetLink.mutate(undefined, { onSuccess: () => toast(t('share.toast.reset')) })
    if (which === 'removeLink') {
      const count = sharing.data?.link.joinedCount ?? 0
      mutations.removeLinkMembers.mutate(undefined, { onSuccess: () => toast(t('share.toast.removedMany', { count })) })
    }
  }

  // ---------------------------------------------------------------- rendering

  const data = sharing.data
  const hint = !empty && root.children.length > 0 && !isCovered(tree, scope, root.topic.id)
  const ownerName = (owner: TopicSharing['owner']): string =>
    owner.id === me?.id ? t('share.you', { name: owner.name }) : owner.name

  return (
    <>
      <Modal open onClose={onClose} title={t('share.title')} subtitle={t('share.subtitle')} width={540}>
        <section className={styles.section}>
          <div className={styles.scopeHead}>
            <span className={editing ? `${styles.heading} ${styles.headingActive}` : styles.heading}>
              {editing ? t('share.scopeFor', { name: editing.member.user.name }) : t('share.scopeHeading')}
            </span>
            {editing && (
              <span className={styles.scopeActions}>
                <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
                <Button variant="primary" disabled={empty} busy={mutations.changeTopics.isPending} onClick={saveTopics}>
                  {t('share.saveTopics')}
                </Button>
              </span>
            )}
          </div>
          <ScopePicker
            tree={tree}
            root={root}
            scope={scope}
            onChange={setScope}
            active={editing !== null}
            label={t('share.scopeHeading')}
          />
          <p className={empty ? `${styles.summary} ${styles.summaryError}` : styles.summary}>
            {empty
              ? t('share.pickOne')
              : t('share.sharing', { topics: scopeLabel(scope), cards: t('cards.count', { count: scopeCards(tree, scope) }) })}
          </p>
          {hint && <p className={styles.hint}>{t('share.futureHint', { title: root.topic.title })}</p>}
        </section>

        {!editing && (
          <form className={styles.invite} onSubmit={submitInvite} noValidate>
            <input
              className={inviteError ? `${styles.login} ${styles.loginInvalid}` : styles.login}
              value={login}
              placeholder={t('share.emailOrUsername')}
              aria-label={t('share.emailOrUsername')}
              aria-invalid={inviteError !== null}
              autoComplete="off"
              data-autofocus
              onChange={(e) => {
                setLogin(e.target.value)
                setInviteError(null)
              }}
            />
            <span className={styles.inviteActions}>
              <button
                type="button"
                className={styles.roleButton}
                aria-haspopup="menu"
                onClick={(e) => openMenuBelow(e.currentTarget, roleItems('viewer', () => undefined), t('share.role'))}
              >
                {t('share.canView')}
                <ChevronDownIcon size={14} />
              </button>
              <Button type="submit" variant="primary" busy={mutations.invite.isPending} disabled={!login.trim() || empty}>
                {t('share.invite')}
              </Button>
            </span>
            {inviteError && (
              <p className={styles.fieldError} role="alert">
                {inviteError}
              </p>
            )}
          </form>
        )}

        <section className={styles.section}>
          <h3 className={styles.heading}>{t('share.people')}</h3>
          {sharing.isLoading && <div className={styles.skeleton} aria-hidden="true" />}
          {sharing.isError && <p className={styles.summaryError}>{errorText(sharing.error)}</p>}
          {data && (
            <ul className={styles.people}>
              <li className={styles.person}>
                <span className={styles.avatar}>{initialOf(data.owner.name)}</span>
                <span className={styles.personText}>
                  <span className={styles.personName}>{ownerName(data.owner)}</span>
                  <span className={styles.personSub}>{data.owner.email}</span>
                </span>
                <span className={styles.ownerMark}>{t('share.owner')}</span>
              </li>

              {data.people.map((member) => (
                <li
                  key={member.user.id}
                  className={editing?.member.user.id === member.user.id ? `${styles.person} ${styles.personEditing}` : styles.person}
                >
                  <span className={styles.avatar}>{initialOf(member.user.name)}</span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>
                      <span className={styles.ellipsis}>{member.user.name}</span>
                      {member.viaLink && <span className={styles.tag}>{t('share.viaLink')}</span>}
                    </span>
                    <span className={styles.personSub} title={scopeLabel(member.topicIds)}>
                      {scopeLabel(member.topicIds)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.roleButton}
                    aria-haspopup="menu"
                    aria-label={t('share.memberActions', { name: member.user.name })}
                    onClick={(e) =>
                      openMenuBelow(e.currentTarget, memberMenu(member), t('share.memberActions', { name: member.user.name }))
                    }
                  >
                    {t(member.role === 'viewer' ? 'share.canView' : 'share.canEdit')}
                    <ChevronDownIcon size={14} />
                  </button>
                </li>
              ))}

              {data.invites.map((invite) => (
                <li key={invite.id} className={styles.person}>
                  <span className={`${styles.avatar} ${styles.avatarPending}`}>@</span>
                  <span className={styles.personText}>
                    <span className={styles.personName}>
                      <span className={styles.ellipsis}>{invite.email}</span>
                      <span className={styles.tag}>{t('share.pending')}</span>
                    </span>
                    <span className={styles.personSub}>
                      {t('share.invited', { when: relativeTime(invite.invitedAt, i18n.language), topics: scopeLabel(invite.topicIds) })}
                    </span>
                  </span>
                  <button type="button" className={styles.revoke} onClick={() => revoke(invite)}>
                    {t('share.revoke')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data && (
          <section className={styles.link}>
            <div className={styles.linkHead}>
              <span className={data.link.enabled ? styles.linkIconOn : styles.linkIcon}>
                <LinkIcon size={16} />
              </span>
              <span className={styles.personText}>
                <span className={styles.linkTitle}>{t(data.link.enabled ? 'share.linkOnTitle' : 'share.linkOffTitle')}</span>
                <span className={styles.personSub}>
                  {data.link.enabled
                    ? `${t('share.linkOpens', { topics: scopeLabel(data.link.topicIds) })} · ${t('share.linkNeedsAccount')}`
                    : t('share.linkOffSub')}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={data.link.enabled}
                aria-label={t('share.linkToggle')}
                className={data.link.enabled ? `${styles.switch} ${styles.switchOn}` : styles.switch}
                disabled={mutations.setLink.isPending}
                onClick={() => toggleLink(data.link)}
              >
                <span className={styles.knob} />
              </button>
            </div>

            {data.link.enabled && data.link.url && (
              <div className={styles.linkBody}>
                <div className={styles.urlRow}>
                  <span className={styles.url} title={data.link.url}>
                    {data.link.url}
                  </span>
                  <Button variant="primary" icon={<CopyIcon size={15} />} onClick={() => copyLink(data.link.url!)}>
                    {t('share.copyLink')}
                  </Button>
                </div>
                {!editing && !empty && !sameScope(scope, data.link.topicIds) && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() =>
                      mutations.setLink.mutate(
                        { enabled: true, topicIds: scope },
                        { onSuccess: () => toast(t('share.toast.linkTopicsSaved')) }
                      )
                    }
                  >
                    {t('share.useSelection')}
                  </button>
                )}
                <div className={styles.linkFoot}>
                  <span className={styles.joined}>
                    {data.link.joinedCount > 0 ? t('share.joined', { count: data.link.joinedCount }) : t('share.joinedNone')}
                  </span>
                  <button type="button" className={styles.textButton} onClick={() => setConfirm('reset')}>
                    {t('share.resetLink')}
                  </button>
                  {data.link.joinedCount > 0 && (
                    <button type="button" className={`${styles.textButton} ${styles.textDanger}`} onClick={() => setConfirm('removeLink')}>
                      {t('share.removeLinkUsers')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </Modal>

      <Menu
        at={menu?.at ?? null}
        items={menu?.items ?? []}
        label={menu?.label ?? ''}
        onClose={() => setMenu(null)}
      />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        width={420}
        title={
          confirm === 'reset'
            ? t('share.confirmReset.title')
            : t('share.confirmRemove.title', { count: data?.link.joinedCount ?? 0 })
        }
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant={confirm === 'reset' ? 'primary' : 'danger'} onClick={doConfirm} data-autofocus>
              {confirm === 'reset' ? t('share.confirmReset.action') : t('share.confirmRemove.action')}
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>{confirm === 'reset' ? t('share.confirmReset.body') : t('share.confirmRemove.body')}</p>
      </Modal>
    </>
  )
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

