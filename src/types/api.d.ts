export {}

declare global {
  interface Window {
    api: {
      winMinimize: () => void
      winMaximize: () => void
      winClose: () => void
      winFullscreen: () => void
      confirmClose: () => void
      onCloseRequest: (cb: () => void) => () => void

      openFolder: () => Promise<string | null>
      readDir: (path: string) => Promise<{
        name: string
        isDirectory: boolean
        path: string
      }[]>
      readFile: (path: string) => Promise<string>
      readFileBase64: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<boolean>
      createFile: (path: string) => Promise<boolean>
      createDir: (path: string) => Promise<boolean>
      renamePath: (oldPath: string, newPath: string) => Promise<boolean>
      deletePath: (path: string) => Promise<boolean>
      listFiles: (root: string) => Promise<string[]>
      watchProject: (root: string) => Promise<void>
      onFsChanged: (cb: () => void) => () => void

      searchInFiles: (
        root: string,
        query: string,
      ) => Promise<{ file: string; line: number; text: string }[]>
      searchReplace: (
        root: string,
        query: string,
        replacement: string,
      ) => Promise<number>

      termRun: (
        id: number,
        command: string,
      ) => Promise<{ cwd: string; done: boolean; output?: string }>
      termStdin: (id: number, data: string) => Promise<void>
      termKill: (id: number) => Promise<void>
      termDispose: (id: number) => Promise<void>
      termGetCwd: (id: number) => Promise<string>
      termSetCwd: (id: number, dir: string) => Promise<string>
      onTermData: (cb: (id: number, data: string) => void) => () => void
      onTermExit: (
        cb: (id: number, code: number, cwd: string) => void,
      ) => () => void

      gitInfo: (root: string) => Promise<{
        installed: boolean
        repo?: boolean
        branch?: string
        remote?: string | null
        changes?: number
        hasCommits?: boolean
      }>
      gitStatus: (root: string) => Promise<Record<string, string>>
      gitIgnored: (root: string) => Promise<string[]>
      gitBranches: (root: string) => Promise<string[]>
      gitLog: (root: string) => Promise<{ hash: string; msg: string }[]>
      gitScanSensitive: (
        root: string,
        files: string[],
      ) => Promise<{ file: string; reason: string }[]>

      sysStats: () => Promise<{ ramMB: number }>

      checkTool: (tool: string) => Promise<boolean>
      openExternal: (url: string) => Promise<void>
    }
  }

  // Battery Status API (Chromium); no viene en los tipos de dom
  interface BatteryManager {
    level: number
    charging: boolean
    addEventListener(
      type: 'levelchange' | 'chargingchange',
      listener: () => void,
    ): void
    removeEventListener(
      type: 'levelchange' | 'chargingchange',
      listener: () => void,
    ): void
  }

  interface Navigator {
    getBattery?: () => Promise<BatteryManager>
  }
}
