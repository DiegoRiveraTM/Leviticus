import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { watch, type FSWatcher } from 'chokidar'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
let allowClose = false

function createWindow() {
  const iconPng = path.join(process.env.APP_ROOT!, 'build', 'icon.png')
  win = new BrowserWindow({
    icon: fs.existsSync(iconPng)
      ? iconPng
      : path.join(process.env.VITE_PUBLIC!, 'electron-vite.svg'),
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

  // el renderer decide si hay cambios sin guardar antes de cerrar
  win.on('close', (e) => {
    if (!allowClose && win) {
      e.preventDefault()
      win.webContents.send('app:close-request')
    }
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
ipcMain.on('win:fullscreen', () => {
  if (win) win.setFullScreen(!win.isFullScreen())
})
ipcMain.on('app:confirm-close', () => {
  allowClose = true
  win?.close()
})

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

ipcMain.handle('fs:readFileBase64', async (_, filePath: string) => {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime =
    ext === 'svg' ? 'image/svg+xml'
    : ext === 'jpg' ? 'image/jpeg'
    : ext === 'ico' ? 'image/x-icon'
    : `image/${ext}`
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
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

// ---------- Listado y búsqueda global ----------

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'dist-electron', 'dist-ssr', 'release',
  'build', 'out', '.next', '.nuxt', 'coverage', 'target', '__pycache__',
  '.venv', 'venv', '.idea', '.vscode', 'bin', 'obj',
])

function walkFiles(root: string, limit = 8000): string[] {
  const found: string[] = []
  const stack = [root]
  while (stack.length && found.length < limit) {
    const dir = stack.pop()!
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name.toLowerCase())) stack.push(full)
      } else if (found.length < limit) {
        found.push(full)
      }
    }
  }
  return found
}

ipcMain.handle('fs:listFiles', (_, root: string) =>
  walkFiles(root).map(f => path.relative(root, f)),
)

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

ipcMain.handle('search:inFiles', (_, root: string, query: string) => {
  const results: { file: string; line: number; text: string }[] = []
  if (!query.trim()) return results
  const q = query.toLowerCase()
  for (const abs of walkFiles(root)) {
    if (results.length >= 500) break
    try {
      if (fs.statSync(abs).size > 1024 * 1024) continue
      const buf = fs.readFileSync(abs)
      if (buf.includes(0)) continue // binario
      const lines = buf.toString('utf-8').split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          results.push({
            file: path.relative(root, abs),
            line: i + 1,
            text: lines[i].trim().slice(0, 200),
          })
          if (results.length >= 500) break
        }
      }
    } catch {
      /* ilegible: se salta */
    }
  }
  return results
})

ipcMain.handle('search:replace', (_, root: string, query: string, replacement: string) => {
  if (!query.trim()) return 0
  const re = new RegExp(escapeRegExp(query), 'gi')
  let count = 0
  for (const abs of walkFiles(root)) {
    try {
      if (fs.statSync(abs).size > 1024 * 1024) continue
      const buf = fs.readFileSync(abs)
      if (buf.includes(0)) continue
      const text = buf.toString('utf-8')
      const matches = text.match(re)
      if (!matches) continue
      fs.writeFileSync(abs, text.replace(re, replacement), 'utf-8')
      count += matches.length
    } catch {
      /* ilegible: se salta */
    }
  }
  return count
})

// ---------- Terminal (multi-sesión) ----------
// Sin node-pty: cada sesión guarda su cwd, interceptamos `cd` y ejecutamos
// cada comando con PowerShell transmitiendo stdout/stderr.

interface TermSession {
  cwd: string
  proc: ChildProcess | null
}

const termSessions = new Map<number, TermSession>()

function getSession(id: number): TermSession {
  let s = termSessions.get(id)
  if (!s) {
    s = { cwd: os.homedir(), proc: null }
    termSessions.set(id, s)
  }
  return s
}

ipcMain.handle('term:getCwd', (_, id: number) => getSession(id).cwd)

ipcMain.handle('term:setCwd', (_, id: number, dir: string) => {
  const s = getSession(id)
  const target = dir === '~' ? os.homedir() : dir
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) s.cwd = target
  return s.cwd
})

ipcMain.handle('term:run', (event, id: number, command: string) => {
  const s = getSession(id)
  const trimmed = command.trim()
  if (!trimmed) return { cwd: s.cwd, done: true }

  // `cd` se maneja aquí para que la navegación persista entre comandos
  const cdMatch = /^cd(?:\s+(.*))?$/i.exec(trimmed)
  if (cdMatch && !/[;&|]/.test(trimmed)) {
    const raw = (cdMatch[1] ?? '').trim().replace(/^["']|["']$/g, '')
    if (!raw) return { cwd: s.cwd, done: true, output: s.cwd + '\r\n' }
    const target = raw === '~' ? os.homedir() : path.resolve(s.cwd, raw)
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      s.cwd = target
      return { cwd: s.cwd, done: true }
    }
    return { cwd: s.cwd, done: true, output: `cd: no existe el directorio: ${raw}\r\n` }
  }

  if (s.proc) {
    return { cwd: s.cwd, done: true, output: 'Ya hay un proceso en ejecución (Ctrl+C para detenerlo)\r\n' }
  }

  const wc = event.sender
  s.proc = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-Command',
    `[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ${trimmed}`,
  ], { cwd: s.cwd })

  s.proc.stdout!.setEncoding('utf8')
  s.proc.stderr!.setEncoding('utf8')
  s.proc.stdout!.on('data', d => wc.send('term:data', id, String(d)))
  s.proc.stderr!.on('data', d => wc.send('term:data', id, String(d)))
  s.proc.on('error', err => wc.send('term:data', id, `${err.message}\r\n`))
  s.proc.on('close', code => {
    s.proc = null
    if (!wc.isDestroyed()) wc.send('term:exit', id, code ?? 0, s.cwd)
  })
  return { cwd: s.cwd, done: false }
})

ipcMain.handle('term:stdin', (_, id: number, data: string) => {
  getSession(id).proc?.stdin?.write(data)
})

ipcMain.handle('term:kill', (_, id: number) => {
  const s = getSession(id)
  if (s.proc?.pid) {
    // taskkill con /t termina también los procesos hijos en Windows
    spawnSync('taskkill', ['/pid', String(s.proc.pid), '/t', '/f'])
  }
})

ipcMain.handle('term:dispose', (_, id: number) => {
  const s = termSessions.get(id)
  if (s?.proc?.pid) spawnSync('taskkill', ['/pid', String(s.proc.pid), '/t', '/f'])
  termSessions.delete(id)
})

// ---------- watcher del proyecto ----------
// avisa al renderer de cualquier cambio en disco (archivos generados por
// DevOps, comandos de la terminal, editores externos…) para que el
// explorador se refresque en tiempo real

let projectWatcher: FSWatcher | null = null

ipcMain.handle('fs:watch', (event, root: string) => {
  void projectWatcher?.close()
  projectWatcher = null
  if (!root) return

  const wc = event.sender
  let timer: ReturnType<typeof setTimeout> | null = null
  projectWatcher = watch(root, {
    // carpetas ruidosas: vigilarlas satura el watcher (npm install genera
    // decenas de miles de eventos) y el explorador igual las colapsa
    ignored: /(^|[\\/])(node_modules|\.git|dist|dist-electron|build|\.venv|venv|__pycache__)([\\/]|$)/,
    ignoreInitial: true,
    depth: 8,
  })
  projectWatcher.on('all', () => {
    // debounce: una ráfaga de cambios = un solo refresco
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (!wc.isDestroyed()) wc.send('fs:changed')
    }, 300)
  })
})

// ---------- Git ----------

function runGit(args: string[], cwd: string) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return {
    ok: r.status === 0,
    out: ((r.stdout ?? '') + (r.stderr ?? '')).trim(),
    // sin trim: el porcelain de git usa el primer carácter como columna de
    // estado (" M x") y recortar la primera línea desalineaba las rutas
    raw: r.stdout ?? '',
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
  // un repo recién inicializado no tiene HEAD: sin esto, el push fallaba
  // con "src refspec ... does not match any" sin pista de la causa
  const hasCommits = runGit(['rev-parse', '--verify', 'HEAD'], root).ok
  const changes = status.ok
    ? status.out.split('\n').filter(l => l.trim()).length
    : 0
  return {
    installed: true,
    repo: true,
    branch,
    remote: remote.ok ? remote.out : null,
    changes,
    hasCommits,
  }
})

ipcMain.handle('git:branches', (_, root: string) => {
  const res = runGit(['branch', '--list', '--format=%(refname:short)'], root)
  if (!res.ok) return []
  return res.out.split('\n').map(b => b.trim()).filter(Boolean)
})

ipcMain.handle('git:log', (_, root: string) => {
  const res = runGit(['log', '--oneline', '-25'], root)
  if (!res.ok) return []
  return res.out.split('\n').filter(Boolean).map(line => {
    const i = line.indexOf(' ')
    return { hash: line.slice(0, i), msg: line.slice(i + 1) }
  })
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
  for (const line of res.raw.split('\n')) {
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

// rutas ignoradas por .gitignore (git las colapsa por carpeta): el
// explorador las atenúa para distinguirlas de lo que sí se trackea
ipcMain.handle('git:ignored', (_, root: string) => {
  const res = runGit(['status', '--porcelain', '--ignored'], root)
  const list: string[] = []
  if (!res.ok) return list
  for (const line of res.raw.split('\n')) {
    if (!line.startsWith('!!')) continue
    const rel = line.slice(3).trim().replace(/^"|"$/g, '').replace(/\/$/, '')
    list.push(path.join(root, rel.replace(/\//g, path.sep)))
  }
  return list
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
