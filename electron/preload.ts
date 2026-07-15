import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // ventana
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winMaximize: () => ipcRenderer.send('win:maximize'),
  winClose: () => ipcRenderer.send('win:close'),
  winFullscreen: () => ipcRenderer.send('win:fullscreen'),
  confirmClose: () => ipcRenderer.send('app:confirm-close'),
  onCloseRequest: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('app:close-request', listener)
    return () => ipcRenderer.off('app:close-request', listener)
  },

  // sistema de archivos
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  readFileBase64: (path: string) => ipcRenderer.invoke('fs:readFileBase64', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  createFile: (path: string) => ipcRenderer.invoke('fs:createFile', path),
  createDir: (path: string) => ipcRenderer.invoke('fs:createDir', path),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  deletePath: (path: string) => ipcRenderer.invoke('fs:delete', path),
  listFiles: (root: string) => ipcRenderer.invoke('fs:listFiles', root),
  watchProject: (root: string) => ipcRenderer.invoke('fs:watch', root),
  onFsChanged: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('fs:changed', listener)
    return () => ipcRenderer.off('fs:changed', listener)
  },

  // búsqueda global
  searchInFiles: (root: string, query: string) =>
    ipcRenderer.invoke('search:inFiles', root, query),
  searchReplace: (root: string, query: string, replacement: string) =>
    ipcRenderer.invoke('search:replace', root, query, replacement),

  // terminal (multi-sesión)
  termRun: (id: number, command: string) => ipcRenderer.invoke('term:run', id, command),
  termStdin: (id: number, data: string) => ipcRenderer.invoke('term:stdin', id, data),
  termKill: (id: number) => ipcRenderer.invoke('term:kill', id),
  termDispose: (id: number) => ipcRenderer.invoke('term:dispose', id),
  termGetCwd: (id: number) => ipcRenderer.invoke('term:getCwd', id),
  termSetCwd: (id: number, dir: string) => ipcRenderer.invoke('term:setCwd', id, dir),
  onTermData: (cb: (id: number, data: string) => void) => {
    const listener = (_e: IpcRendererEvent, id: number, data: string) => cb(id, data)
    ipcRenderer.on('term:data', listener)
    return () => ipcRenderer.off('term:data', listener)
  },
  onTermExit: (cb: (id: number, code: number, cwd: string) => void) => {
    const listener = (_e: IpcRendererEvent, id: number, code: number, cwd: string) =>
      cb(id, code, cwd)
    ipcRenderer.on('term:exit', listener)
    return () => ipcRenderer.off('term:exit', listener)
  },

  // git
  gitInfo: (root: string) => ipcRenderer.invoke('git:info', root),
  gitStatus: (root: string) => ipcRenderer.invoke('git:status', root),
  gitIgnored: (root: string) => ipcRenderer.invoke('git:ignored', root),
  gitBranches: (root: string) => ipcRenderer.invoke('git:branches', root),
  gitLog: (root: string) => ipcRenderer.invoke('git:log', root),
  gitScanSensitive: (root: string, files: string[]) =>
    ipcRenderer.invoke('git:scanSensitive', root, files),

  // métricas
  sysStats: () => ipcRenderer.invoke('sys:stats'),

  // herramientas
  checkTool: (tool: string) => ipcRenderer.invoke('tools:check', tool),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
})
