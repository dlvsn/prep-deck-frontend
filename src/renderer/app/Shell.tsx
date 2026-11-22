import { useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '@/api'
import { AppearancePanel } from '@/features/settings/AppearancePanel'
import { LogOutIcon, LogoIcon, PaletteIcon, PracticeIcon, SharedIcon, TopicsIcon } from '@/ui/icons'
import { Popover } from '@/ui/Popover'
import { TitleBar } from '@/ui/TitleBar'
import { platform } from './platform'
import styles from './Shell.module.css'
import { useLayoutMode } from './useLayoutMode'

const SECTIONS = [
  { to: '/topics', icon: TopicsIcon, label: 'nav.myTopics', short: 'nav.myTopics' },
  { to: '/shared', icon: SharedIcon, label: 'nav.shared', short: 'nav.sharedShort' },
  { to: '/practice', icon: PracticeIcon, label: 'nav.practice', short: 'nav.practice' }
] as const

/**
 * The frame every screen sits in: title bar (desktop only), the rail at the left, or a bottom
 * bar when the window is narrow, and the routed screen in the middle.
 */
export function Shell() {
  const { t } = useTranslation()
  const mode = useLayoutMode()
  const narrow = mode === 'narrow'
  const iconsOnly = mode === 'compact'

  const appearanceButton = useRef<HTMLButtonElement>(null)
  const avatarButton = useRef<HTMLButtonElement>(null)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const closeAppearance = useCallback(() => setAppearanceOpen(false), [])

  const me = useQuery({ queryKey: ['me'], queryFn: () => api.auth.me() })
  const shared = useQuery({ queryKey: ['topics', 'shared'], queryFn: () => api.topics.listShared() })
  const invites = shared.data?.filter((topic) => topic.unseen && topic.parentId === null).length ?? 0
  const initial = me.data?.name.charAt(0).toUpperCase() ?? ''

  // Log out arrives with the login screens (stage 2); until then the button is shown but inert.
  const logout = undefined

  return (
    <div className={styles.app}>
      {platform.windowControls && <TitleBar controls={platform.windowControls} />}

      <div className={narrow ? styles.bodyNarrow : styles.body}>
        {!narrow && (
          <nav className={iconsOnly ? `${styles.rail} ${styles.railCompact}` : styles.rail} aria-label={t('app.name')}>
            <div className={styles.logo} aria-hidden="true">
              <LogoIcon size={20} />
            </div>

            <div className={styles.railItems}>
              {SECTIONS.map(({ to, icon: Icon, label, short }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `${styles.railItem} ${isActive ? styles.active : ''}`}
                  aria-label={t(label)}
                  title={iconsOnly ? t(label) : undefined}
                >
                  <span className={styles.railIcon}>
                    <Icon size={22} />
                    {to === '/shared' && invites > 0 && (
                      <span className={styles.badge} aria-label={t('nav.newInvites', { count: invites })}>
                        {invites}
                      </span>
                    )}
                  </span>
                  {!iconsOnly && <span className={styles.railLabel}>{t(short)}</span>}
                </NavLink>
              ))}
            </div>

            <div className={styles.railBottom}>
              <button
                ref={appearanceButton}
                type="button"
                className={`${styles.railItem} ${appearanceOpen ? styles.active : ''}`}
                aria-label={t('settings.appearance')}
                aria-expanded={appearanceOpen}
                title={t('settings.appearance')}
                onClick={() => setAppearanceOpen((open) => !open)}
              >
                <span className={styles.railIcon}>
                  <PaletteIcon size={22} />
                </span>
              </button>
              <span className={styles.avatar} title={me.data?.name} aria-label={t('auth.account')}>
                {initial}
              </span>
              <button
                type="button"
                className={styles.railItem}
                aria-label={t('auth.logout')}
                title={t('auth.logout')}
                onClick={logout}
              >
                <span className={styles.railIcon}>
                  <LogOutIcon size={22} />
                </span>
              </button>
            </div>
          </nav>
        )}

        <main className={styles.main}>
          <Outlet />
        </main>

        {narrow && (
          <nav className={styles.bottomBar} aria-label={t('app.name')}>
            {SECTIONS.map(({ to, icon: Icon, label, short }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
                aria-label={t(label)}
              >
                <span className={styles.railIcon}>
                  <Icon size={22} />
                  {to === '/shared' && invites > 0 && <span className={styles.badge}>{invites}</span>}
                </span>
                <span className={styles.tabLabel}>{t(short)}</span>
              </NavLink>
            ))}
            <button
              ref={avatarButton}
              type="button"
              className={styles.tab}
              aria-label={t('settings.appearance')}
              aria-expanded={appearanceOpen}
              onClick={() => setAppearanceOpen((open) => !open)}
            >
              <span className={`${styles.avatar} ${appearanceOpen ? styles.avatarActive : ''}`}>{initial}</span>
            </button>
          </nav>
        )}
      </div>

      <Popover
        open={appearanceOpen}
        onClose={closeAppearance}
        anchor={narrow ? avatarButton : appearanceButton}
        placement={narrow ? 'sheet' : 'right-end'}
        label={t('settings.appearance')}
      >
        <AppearancePanel onLogout={narrow ? logout : undefined} />
      </Popover>
    </div>
  )
}
