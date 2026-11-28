import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join, resolve } from 'node:path'
import { ARG, DEEP_LINK_SCHEME, IPC } from '../shared/ipc'
import { clearSecret, readSecret, writeSecret } from './secureStore'
import { loadWindowState, MIN_HEIGHT, MIN_WIDTH, trackWindowState } from './windowState'

let mainWindow: BrowserWindow | null = null

/** The link the app was started with, until the renderer asks for it. */
let pendingDeepLink: string | null = null

/** On Windows a link arrives as an argument of the process the OS starts for it. */
function deepLinkIn(argv: string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null
}

/**
 * Makes Windows open prepdeck:// links with this app. Unpackaged, Electron runs our script, so
 * the script's path goes along with the executable.
 */
function registerDeepLinks(): void {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)
  }
}

function createWindow(): void {
  const state = loadWindowState()

  mainWindow = new BrowserWindow({
    ...state.bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    show: false,
    title: 'Prep Deck',
    // Matches --bg of the mode the OS prefers; the renderer applies the saved one before it paints.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f1115' : '#f4f6f9',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: [ARG.locale + app.getLocale(), ARG.version + app.getVersion()]
    }
  })

  if (state.maximized) mainWindow.maximize()
  trackWindowState(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('maximize', () => mainWindow?.webContents.send(IPC.maximizedChanged, true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send(IPC.maximizedChanged, false))
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Links in card answers open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // A file dropped outside every drop zone would make Chromium navigate to file://… and replace
  // the app with it. The renderer already cancels such drops; this is the backstop. The window
  // never navigates anywhere but its own page.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  const sender = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null =>
    BrowserWindow.fromWebContents(e.sender)

  ipcMain.on(IPC.minimize, (e) => sender(e)?.minimize())
  ipcMain.on(IPC.toggleMaximize, (e) => {
    const win = sender(e)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on(IPC.close, (e) => sender(e)?.close())
  ipcMain.handle(IPC.isMaximized, (e) => sender(e)?.isMaximized() ?? false)

  ipcMain.handle(IPC.secureGet, () => readSecret())
  ipcMain.handle(IPC.secureSet, (_e, value: unknown) => {
    if (typeof value !== 'string') throw new Error('secure:set expects a string')
    writeSecret(value)
  })
  ipcMain.handle(IPC.secureClear, () => clearSecret())
  ipcMain.handle(IPC.takeDeepLink, () => {
    const link = pendingDeepLink
    pendingDeepLink = null
    return link
  })
}

// One running copy: a second launch focuses the first. A share link opened while the app runs
// arrives this way too, as an argument of that second launch.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  pendingDeepLink = deepLinkIn(process.argv)

  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    const link = deepLinkIn(argv)
    if (link) mainWindow.webContents.send(IPC.deepLink, link)
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.prepdeck.app')
    registerDeepLinks()
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
