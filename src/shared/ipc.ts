/** IPC channel names, written once for main and preload. */
export const IPC = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  secureGet: 'secure:get',
  secureSet: 'secure:set',
  secureClear: 'secure:clear'
} as const

/** Values main hands to the preload through process arguments, read synchronously at start-up. */
export const ARG = {
  locale: '--prep-deck-locale=',
  version: '--prep-deck-version='
} as const
