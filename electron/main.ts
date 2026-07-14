import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
    width: 1440,
    height: 900,
    minWidth: 920,
    minHeight: 580,
    frame: false,
    backgroundColor: '#02040a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    title: 'Levitico',
    autoHideMenuBar: true,
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  win.webContents.on('before-input-event', (_, input) => {
    if (!input.control) return
    const zoom = win!.webContents.getZoomFactor()
    if (input.key === '=' || input.key === '+') win!.webContents.setZoomFactor(Math.min(zoom + 0.1, 3))
    if (input.key === '-') win!.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.3))
    if (input.key === '0') win!.webContents.setZoomFactor(1)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ---------- Window controls (frameless) ----------

ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:maximize', () => {
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.on('win:close', () => win?.close())

// ---------- File system ----------

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('fs:readDir', async (_, folderPath: string) => {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true })
  return entries
    .map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(folderPath, entry.name)
    }))
    .sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return fs.readFileSync(filePath, 'utf-8')
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  fs.writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('fs:createFile', async (_, filePath: string) => {
  if (fs.existsSync(filePath)) return false
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, '', 'utf-8')
  return true
})

ipcMain.handle('fs:createDir', async (_, dirPath: string) => {
  if (fs.existsSync(dirPath)) return false
  fs.mkdirSync(dirPath, { recursive: true })
  return true
})

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  if (!fs.existsSync(oldPath) || fs.existsSync(newPath)) return false
  fs.renameSync(oldPath, newPath)
  return true
})

// borra enviando a la papelera de reciclaje, no destruye directamente
ipcMain.handle('fs:delete', async (_, target: string) => {
  try {
    await shell.trashItem(target)
    return true
  } catch {
    return false
  }
})

// ---------- Terminal ----------
// Sin node-pty: mantenemos el cwd en el proceso principal, interceptamos `cd`
// y ejecutamos cada comando con PowerShell transmitiendo stdout/stderr.

let termCwd = os.homedir()
let termProc: ChildProcess | null = null

ipcMain.handle('term:getCwd', () => termCwd)

ipcMain.handle('term:setCwd', (_, dir: string) => {
  const target = dir === '~' ? os.homedir() : dir
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) termCwd = target
  return termCwd
})

ipcMain.handle('term:run', (event, command: string) => {
  const trimmed = command.trim()
  if (!trimmed) return { cwd: termCwd, done: true }

  // `cd` se maneja aquí para que la navegación persista entre comandos
  const cdMatch = /^cd(?:\s+(.*))?$/i.exec(trimmed)
  if (cdMatch && !/[;&|]/.test(trimmed)) {
    const raw = (cdMatch[1] ?? '').trim().replace(/^["']|["']$/g, '')
    if (!raw) return { cwd: termCwd, done: true, output: termCwd + '\r\n' }
    const target = raw === '~' ? os.homedir() : path.resolve(termCwd, raw)
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      termCwd = target
      return { cwd: termCwd, done: true }
    }
    return { cwd: termCwd, done: true, output: `cd: no existe el directorio: ${raw}\r\n` }
  }

  if (termProc) {
    return { cwd: termCwd, done: true, output: 'Ya hay un proceso en ejecución (Ctrl+C para detenerlo)\r\n' }
  }

  const wc = event.sender
  termProc = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-Command',
    `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${trimmed}`,
  ], { cwd: termCwd })

  termProc.stdout!.setEncoding('utf8')
  termProc.stderr!.setEncoding('utf8')
  termProc.stdout!.on('data', d => wc.send('term:data', String(d)))
  termProc.stderr!.on('data', d => wc.send('term:data', String(d)))
  termProc.on('error', err => wc.send('term:data', `${err.message}\r\n`))
  termProc.on('close', code => {
    termProc = null
    if (!wc.isDestroyed()) wc.send('term:exit', code ?? 0, termCwd)
  })
  return { cwd: termCwd, done: false }
})

ipcMain.handle('term:stdin', (_, data: string) => {
  termProc?.stdin?.write(data)
})

ipcMain.handle('term:kill', () => {
  if (termProc?.pid) {
    // taskkill con /t termina también los procesos hijos en Windows
    spawnSync('taskkill', ['/pid', String(termProc.pid), '/t', '/f'])
  }
})

// ---------- Git ----------

function runGit(args: string[], cwd: string) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return {
    ok: r.status === 0,
    out: ((r.stdout ?? '') + (r.stderr ?? '')).trim(),
  }
}

ipcMain.handle('git:info', (_, root: string) => {
  const installed = spawnSync('where.exe', ['git']).status === 0
  if (!installed) return { installed: false }
  const inRepo = runGit(['rev-parse', '--is-inside-work-tree'], root).ok
  if (!inRepo) return { installed: true, repo: false }
  const branch = runGit(['branch', '--show-current'], root).out || 'main'
  const remote = runGit(['remote', 'get-url', 'origin'], root)
  const status = runGit(['status', '--porcelain'], root)
  const changes = status.ok
    ? status.out.split('\n').filter(l => l.trim()).length
    : 0
  return {
    installed: true,
    repo: true,
    branch,
    remote: remote.ok ? remote.out : null,
    changes,
  }
})

ipcMain.handle('git:branches', (_, root: string) => {
  const res = runGit(['branch', '--list', '--format=%(refname:short)'], root)
  if (!res.ok) return []
  return res.out.split('\n').map(b => b.trim()).filter(Boolean)
})

// ---- escáner de información sensible antes de un commit ----

const SENSITIVE_NAME = /(^\.env|\.env\.|\.env$|credential|secret|id_rsa|id_ed25519|\.pem$|\.pfx$|\.p12$|\.key$|\.keystore$)/i

const SENSITIVE_CONTENT: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'clave privada embebida'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}/, 'token de GitHub'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API key (formato sk-…)'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'token de Slack'],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}/, 'JWT embebido'],
  [/(api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*['"][^'"\n]{8,}['"]/i, 'credencial en texto plano'],
]

ipcMain.handle('git:scanSensitive', (_, root: string, files: string[]) => {
  const findings: { file: string; reason: string }[] = []
  for (const rel of files) {
    if (SENSITIVE_NAME.test(path.basename(rel))) {
      findings.push({ file: rel, reason: 'nombre de archivo sensible (variables de entorno / claves)' })
      continue
    }
    try {
      const abs = path.join(root, rel)
      const stat = fs.statSync(abs)
      if (!stat.isFile() || stat.size > 1024 * 1024) continue
      const buf = fs.readFileSync(abs)
      if (buf.includes(0)) continue // binario
      const text = buf.toString('utf-8')
      for (const [re, reason] of SENSITIVE_CONTENT) {
        if (re.test(text)) {
          findings.push({ file: rel, reason })
          break
        }
      }
    } catch {
      /* archivo borrado o ilegible: nada que escanear */
    }
  }
  return findings
})

// estado por archivo para colorear el explorador: ruta absoluta → letra
ipcMain.handle('git:status', (_, root: string) => {
  const res = runGit(['status', '--porcelain', '-uall'], root)
  const map: Record<string, string> = {}
  if (!res.ok) return map
  for (const line of res.out.split('\n')) {
    if (line.trim().length < 4) continue
    const code = line.slice(0, 2)
    let rel = line.slice(3).trim().replace(/^"|"$/g, '')
    if (rel.includes(' -> ')) rel = rel.split(' -> ')[1]
    const abs = path.join(root, rel.replace(/\//g, path.sep))
    map[abs] = code.includes('?') ? 'U'
      : code.includes('A') ? 'A'
      : code.includes('D') ? 'D'
      : code.includes('R') ? 'R'
      : 'M'
  }
  return map
})

// ---------- Métricas del sistema ----------

ipcMain.handle('sys:stats', () => {
  // suma la memoria de todos los procesos de la app (main, renderer, GPU…)
  const metrics = app.getAppMetrics()
  const ramMB = Math.round(
    metrics.reduce((sum, m) => sum + m.memory.workingSetSize, 0) / 1024,
  )
  return { ramMB }
})

// ---------- Herramientas / lenguajes ----------

ipcMain.handle('tools:check', (_, tool: string) => {
  const probe = process.platform === 'win32'
    ? spawnSync('where.exe', [tool])
    : spawnSync('which', [tool])
  return probe.status === 0
})

ipcMain.handle('shell:openExternal', (_, url: string) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.whenReady().then(createWindow)
