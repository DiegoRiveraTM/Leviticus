export {}

declare global {
  interface Window {
    api: {
      winMinimize: () => void
      winMaximize: () => void
      winClose: () => void

      openFolder: () => Promise<string | null>
      readDir: (path: string) => Promise<{
        name: string
        isDirectory: boolean
        path: string
      }[]>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<boolean>
      createFile: (path: string) => Promise<boolean>
      createDir: (path: string) => Promise<boolean>
      renamePath: (oldPath: string, newPath: string) => Promise<boolean>
      deletePath: (path: string) => Promise<boolean>

      termRun: (command: string) => Promise<{ cwd: string; done: boolean; output?: string }>
      termStdin: (data: string) => Promise<void>
      termKill: () => Promise<void>
      termGetCwd: () => Promise<string>
      termSetCwd: (dir: string) => Promise<string>
      onTermData: (cb: (data: string) => void) => () => void
      onTermExit: (cb: (code: number, cwd: string) => void) => () => void

      gitInfo: (root: string) => Promise<{
        installed: boolean
        repo?: boolean
        branch?: string
        remote?: string | null
        changes?: number
      }>
      gitStatus: (root: string) => Promise<Record<string, string>>
      gitBranches: (root: string) => Promise<string[]>
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
