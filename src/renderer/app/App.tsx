import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppearanceSync } from './AppearanceSync'
import { Placeholder } from './Placeholder'
import { Shell } from './Shell'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
  }
})

/**
 * Hash routing: the packaged app loads index.html from disk, where path routing has no server
 * to fall back on. It works the same in a browser.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceSync />
      <HashRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/topics" element={<Placeholder titleKey="nav.myTopics" />} />
            <Route path="/shared" element={<Placeholder titleKey="nav.shared" />} />
            <Route path="/practice" element={<Placeholder titleKey="nav.practice" />} />
            <Route path="*" element={<Navigate to="/topics" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}
