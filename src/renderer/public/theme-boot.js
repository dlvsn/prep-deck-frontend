// Runs before the first paint so a dark-mode user never sees a flash of the light theme.
// Reads what theme/appearanceStore.ts persists; keep the key and the defaults in step with it.
;(function () {
  var mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  var accent = 'mint'
  try {
    var saved = JSON.parse(localStorage.getItem('prep-deck.appearance') || 'null')
    var state = saved && saved.state
    if (state && (state.mode === 'dark' || state.mode === 'light')) mode = state.mode
    if (state && typeof state.accent === 'string') accent = state.accent
    if (state && (state.language === 'en' || state.language === 'uk')) {
      document.documentElement.lang = state.language
    }
  } catch (e) {
    // Storage unavailable or corrupt: the OS preference and Mint stand.
  }
  document.documentElement.dataset.mode = mode
  document.documentElement.dataset.accent = accent
})()
