import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './theme/tokens.css'
import './theme/base.css'
import './i18n'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { platform } from './app/platform'
import { trackResizing } from './app/useLayoutMode'

trackResizing()
// A file dropped anywhere but a drop zone must not open in the window instead of the app.
// Drop zones (features/cards/images/useFileDrop) handle their own drops before this sees them.
for (const type of ['dragover', 'drop'] as const) {
  document.addEventListener(type, (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  })
}
// Lets CSS leave room for our own title bar, which only the desktop app has.
document.documentElement.dataset.platform = platform.kind

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
