import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // ventana
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winMaximize: () => ipcRenderer.send('win:maximize'),
  winClose: () => ipcRenderer.send('win:close'),

  // sistema de archivos
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (path: string) => ipcRenderer.invoke('fs:readDir', path),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  createFile: (path: string) => ipcRenderer.invoke('fs:createFile', path),
  createDir: (path: string) => ipcRenderer.invoke('fs:createDir', path),
  renamePath: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  deletePath: (path: string) => ipcRenderer.invoke('fs:delete', path),

  // terminal
  termRun: (command: string) => ipcRenderer.invoke('term:run', command),
  termStdin: (data: string) => ipcRenderer.invoke('term:stdin', data),
  termKill: () => ipcRenderer.invoke('term:kill'),
  termGetCwd: () => ipcRenderer.invoke('term:getCwd'),
  termSetCwd: (dir: string) => ipcRenderer.invoke('term:setCwd', dir),
  onTermData: (cb: (data: string) => void) => {
    const listener = (_e: IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('term:data', listener)
    return () => ipcRenderer.off('term:data', listener)
  },
  onTermExit: (cb: (code: number, cwd: string) => void) => {
    const listener = (_e: IpcRendererEvent, code: number, cwd: string) => cb(code, cwd)
    ipcRenderer.on('term:exit', listener)
    return () => ipcRenderer.off('term:exit', listener)
  },

  // git
  gitInfo: (root: string) => ipcRenderer.invoke('git:info', root),
  gitStatus: (root: string) => ipcRenderer.invoke('git:status', root),
  gitBranches: (root: string) => ipcRenderer.invoke('git:branches', root),
  gitScanSensitive: (root: string, files: string[]) =>
    ipcRenderer.invoke('git:scanSensitive', root, files),

  // métricas
  sysStats: () => ipcRenderer.invoke('sys:stats'),

  // herramientas
  checkTool: (tool: string) => ipcRenderer.invoke('tools:check', tool),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
})
