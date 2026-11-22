import { contextBridge, ipcRenderer } from 'electron'
import type { PrepDeckBridge } from '../shared/bridge'
import { ARG, IPC } from '../shared/ipc'

const arg = (prefix: string): string =>
  process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length) ?? ''

const bridge: PrepDeckBridge = {
  kind: 'electron',
  locale: arg(ARG.locale),
  version: arg(ARG.version),
  window: {
    minimize: () => ipcRenderer.send(IPC.minimize),
    toggleMaximize: () => ipcRenderer.send(IPC.toggleMaximize),
    close: () => ipcRenderer.send(IPC.close),
    isMaximized: () => ipcRenderer.invoke(IPC.isMaximized),
    onMaximizedChange: (listener) => {
      const handler = (_e: Electron.IpcRendererEvent, maximized: boolean): void => listener(maximized)
      ipcRenderer.on(IPC.maximizedChanged, handler)
      return () => ipcRenderer.removeListener(IPC.maximizedChanged, handler)
    }
  },
  secureStore: {
    get: () => ipcRenderer.invoke(IPC.secureGet),
    set: (value) => ipcRenderer.invoke(IPC.secureSet, value),
    clear: () => ipcRenderer.invoke(IPC.secureClear)
  }
}

contextBridge.exposeInMainWorld('prepDeck', bridge)
