import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from '@/features/auth/AuthScreen'
import { TopicsPage } from '@/features/topics/TopicsPage'
import { Toaster } from '@/ui/Toaster'
import { TitleBar } from '@/ui/TitleBar'
import styles from './App.module.css'
import { AppearanceSync } from './AppearanceSync'
import { Placeholder } from './Placeholder'
import { platform } from './platform'
import { onSessionEnd, useSession } from './session'
// Side effect: syncs theme, accent, language and the last topic with the server per user.
import './settingsSync'
import { Shell } from './Shell'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
})

// Whatever the previous user saw must not show for the next one.
onSessionEnd(() => queryClient.clear())

/**
 * The window: our title bar on the desktop, then either the login screen or the app.
 * Hash routing, because the packaged app loads index.html from disk, where path routing has no
 * server to fall back on; it works the same in a browser.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceSync />
      <div className={styles.frame}>
        {platform.windowControls && <TitleBar controls={platform.windowControls} />}
        <div className={styles.content}>
          <SessionGate />
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  )
}

function SessionGate() {
  const status = useSession((s) => s.status)

  useEffect(() => {
    void useSession.getState().restore()
  }, [])

  // Checking the stored session takes one round trip; the theme's background shows meanwhile.
  if (status === 'starting') return null
  if (status === 'anonymous') return <AuthScreen />

  return (
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/:topicId" element={<TopicsPage />} />
          <Route path="/shared" element={<Placeholder titleKey="nav.shared" />} />
          <Route path="/practice" element={<Placeholder titleKey="nav.practice" />} />
          <Route path="*" element={<Navigate to="/topics" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
