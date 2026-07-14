import { useEffect, useRef, useState } from "react";
import FileTree from "./components/FileTree";
import Editor, { type MonacoEditorInstance } from "./components/Editor";
import StatusExtras from "./components/StatusExtras";
import Terminal, { TerminalHandle } from "./components/Terminal";
import IntroScreen from "./components/IntroScreen";
import QuickOpen from "./components/QuickOpen";
import SearchPanel from "./components/SearchPanel";
import DevOpsPanel from "./components/DevOpsPanel";
import { MarkdownView, ImageView } from "./components/Preview";
import { getFileLanguage } from "./languages";
import "./App.css";

interface Runner {
  tool: string;
  name: string;
  url: string;
  cmd: (file: string) => string;
}

// Ejecutores por lenguaje: herramienta requerida, link de descarga y comando
const RUNNERS: Record<string, Runner> = {
  python: {
    tool: "python",
    name: "Python",
    url: "https://www.python.org/downloads/",
    cmd: (f) => `python "${f}"`,
  },
  javascript: {
    tool: "node",
    name: "Node.js",
    url: "https://nodejs.org/es/download",
    cmd: (f) => `node "${f}"`,
  },
  typescript: {
    tool: "node",
    name: "Node.js",
    url: "https://nodejs.org/es/download",
    cmd: (f) => `npx tsx "${f}"`,
  },
  java: {
    tool: "java",
    name: "Java (JDK)",
    url: "https://adoptium.net/es/temurin/releases/",
    cmd: (f) => `java "${f}"`,
  },
  go: {
    tool: "go",
    name: "Go",
    url: "https://go.dev/dl/",
    cmd: (f) => `go run "${f}"`,
  },
  rust: {
    tool: "rustc",
    name: "Rust",
    url: "https://rustup.rs/",
    cmd: (f) => `rustc "${f}" -o "${f}.exe"; & "${f}.exe"`,
  },
  c: {
    tool: "gcc",
    name: "GCC (MinGW/MSYS2)",
    url: "https://www.msys2.org/",
    cmd: (f) => `gcc "${f}" -o "${f}.exe"; & "${f}.exe"`,
  },
  cpp: {
    tool: "g++",
    name: "G++ (MinGW/MSYS2)",
    url: "https://www.msys2.org/",
    cmd: (f) => `g++ "${f}" -o "${f}.exe"; & "${f}.exe"`,
  },
  csharp: {
    tool: "dotnet",
    name: ".NET SDK",
    url: "https://dotnet.microsoft.com/es-es/download",
    cmd: (f) => `dotnet run --project "${f.replace(/[\\/][^\\/]+$/, "")}"`,
  },
  php: {
    tool: "php",
    name: "PHP",
    url: "https://windows.php.net/download/",
    cmd: (f) => `php "${f}"`,
  },
  ruby: {
    tool: "ruby",
    name: "Ruby",
    url: "https://rubyinstaller.org/",
    cmd: (f) => `ruby "${f}"`,
  },
};

interface MissingTool {
  name: string;
  url: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;
const SESSION_KEY = "lv-session";

function App() {
  const [intro, setIntro] = useState(true);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [restoredRoot, setRestoredRoot] = useState<string | null>(null);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [missingTool, setMissingTool] = useState<MissingTool | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(
    () => Number(localStorage.getItem("lv-sidebar-w")) || 224,
  );
  const [termHeight, setTermHeight] = useState(
    () => Number(localStorage.getItem("lv-term-h")) || 216,
  );
  const [dragging, setDragging] = useState<"v" | "h" | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarView, setSidebarView] = useState<"files" | "search">("files");
  const [quickOpen, setQuickOpen] = useState(false);
  const [devops, setDevops] = useState(false);
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem("lv-autosave") === "1",
  );
  const [mdPreview, setMdPreview] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  // git
  const [gitStatuses, setGitStatuses] = useState<Record<string, string>>({});
  const [gitPanel, setGitPanel] = useState(false);
  const [gitInfo, setGitInfo] = useState<{
    installed: boolean;
    repo?: boolean;
    branch?: string;
    remote?: string | null;
    changes?: number;
  } | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [gitBranchList, setGitBranchList] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [newBranch, setNewBranch] = useState("");
  const [branchMode, setBranchMode] = useState(false);
  const [gitLogList, setGitLogList] = useState<{ hash: string; msg: string }[] | null>(null);
  const [sensWarning, setSensWarning] = useState<
    { file: string; reason: string }[] | null
  >(null);

  // terminales
  const [termIds, setTermIds] = useState<number[]>([1]);
  const [activeTerm, setActiveTerm] = useState(1);
  const nextTermIdRef = useRef(2);
  const termRefs = useRef(new Map<number, TerminalHandle>());

  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const activeRef = useRef(activeFile);
  const contentsRef = useRef(contents);
  const rootRef = useRef(rootPath);
  const openFilesRef = useRef(openFiles);
  const dirtyRef = useRef(dirty);
  const autoSaveRef = useRef(autoSave);
  activeRef.current = activeFile;
  contentsRef.current = contents;
  rootRef.current = rootPath;
  openFilesRef.current = openFiles;
  dirtyRef.current = dirty;
  autoSaveRef.current = autoSave;
  const openedUrlsRef = useRef(new Set<string>());
  const autosaveTimerRef = useRef<number>();

  // ---------- sesión persistente ----------

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as {
        root: string | null;
        files: string[];
        active: string | null;
      };
      if (session.root) {
        setRestoredRoot(session.root);
        setRootPath(session.root);
      }
      void (async () => {
        for (const file of session.files ?? []) {
          try {
            const content = IMAGE_RE.test(file)
              ? ""
              : await window.api.readFile(file);
            setContents((prev) => ({ ...prev, [file]: content }));
            setOpenFiles((prev) => (prev.includes(file) ? prev : [...prev, file]));
          } catch {
            /* el archivo ya no existe */
          }
        }
        if (session.active) setActiveFile(session.active);
      })();
    } catch {
      /* sesión corrupta: se ignora */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ root: rootPath, files: openFiles, active: activeFile }),
    );
  }, [rootPath, openFiles, activeFile]);

  useEffect(() => {
    localStorage.setItem("lv-autosave", autoSave ? "1" : "0");
  }, [autoSave]);

  // ---------- git status ----------

  async function refreshGitStatuses() {
    const root = rootRef.current;
    if (!root) {
      setGitStatuses({});
      return;
    }
    try {
      setGitStatuses(await window.api.gitStatus(root));
    } catch {
      setGitStatuses({});
    }
  }

  useEffect(() => {
    void refreshGitStatuses();
  }, [rootPath]);

  useEffect(() => {
    const off = window.api.onTermExit(() => void refreshGitStatuses());
    return off;
  }, []);

  // ---------- archivos ----------

  async function handleFileOpen(path: string) {
    if (!(path in contentsRef.current)) {
      let content = "";
      if (!IMAGE_RE.test(path)) {
        try {
          content = await window.api.readFile(path);
        } catch {
          return;
        }
      }
      setContents((prev) => ({ ...prev, [path]: content }));
    }
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    setMdPreview(false);
  }

  // abrir y saltar a una línea (resultados de búsqueda)
  async function openFileAt(path: string, line: number) {
    await handleFileOpen(path);
    setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.revealLineInCenter(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }, 180);
  }

  function closeTab(path: string) {
    setOpenFiles((prev) => {
      const idx = prev.indexOf(path);
      const next = prev.filter((p) => p !== path);
      if (activeRef.current === path) {
        setActiveFile(next.length ? next[Math.max(0, idx - 1)] : null);
        setCursor({ line: 1, col: 1 });
      }
      return next;
    });
    setContents((prev) => {
      const rest = { ...prev };
      delete rest[path];
      return rest;
    });
    setDirty((prev) => {
      const rest = { ...prev };
      delete rest[path];
      return rest;
    });
  }

  function handleCloseProject() {
    setRootPath(null);
    setRestoredRoot(null);
    setOpenFiles([]);
    setActiveFile(null);
    setContents({});
    setDirty({});
    setCursor({ line: 1, col: 1 });
  }

  async function saveFilePath(path: string): Promise<boolean> {
    const content = contentsRef.current[path];
    if (content === undefined || IMAGE_RE.test(path)) return false;
    await window.api.writeFile(path, content);
    setDirty((prev) => ({ ...prev, [path]: false }));
    void refreshGitStatuses();
    return true;
  }

  async function saveFile(): Promise<boolean> {
    const path = activeRef.current;
    if (!path) return false;
    return saveFilePath(path);
  }

  async function saveAll() {
    for (const path of openFilesRef.current) {
      if (dirtyRef.current[path]) await saveFilePath(path);
    }
  }

  // tras un reemplazo global, recargar los archivos abiertos desde disco
  async function reloadOpenFiles() {
    for (const path of openFilesRef.current) {
      if (IMAGE_RE.test(path)) continue;
      try {
        const content = await window.api.readFile(path);
        setContents((prev) => ({ ...prev, [path]: content }));
        setDirty((prev) => ({ ...prev, [path]: false }));
      } catch {
        /* borrado entre tanto */
      }
    }
    void refreshGitStatuses();
  }

  // ---------- atajos globales ----------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault();
        window.api.winFullscreen();
        return;
      }
      if (!e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        void saveFile();
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        void saveAll();
      } else if (key === "w" && !e.shiftKey) {
        e.preventDefault();
        if (activeRef.current) closeTab(activeRef.current);
      } else if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        setQuickOpen(true);
      } else if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        setSidebarVisible(true);
        setSidebarView("search");
        setTimeout(
          () => document.getElementById("global-search-input")?.focus(),
          50,
        );
      } else if (e.key === "Tab") {
        e.preventDefault();
        const files = openFilesRef.current;
        const current = activeRef.current;
        if (files.length > 1 && current) {
          const idx = files.indexOf(current);
          setActiveFile(files[(idx + 1) % files.length]);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- cierre con cambios sin guardar ----------

  useEffect(() => {
    const off = window.api.onCloseRequest(() => {
      const hasDirty = openFilesRef.current.some((f) => dirtyRef.current[f]);
      if (hasDirty) setCloseConfirm(true);
      else window.api.confirmClose();
    });
    return off;
  }, []);

  // ---------- vista previa del dev server ----------

  useEffect(() => {
    const off = window.api.onTermData((_id, data) => {
      // eslint-disable-next-line no-control-regex
      const clean = data.replace(/\x1b\[[0-9;]*m/g, "");
      const match = clean.match(
        /https?:\/\/(?:localhost|127\.0\.0\.1):\d+[^\s"'<>]*/,
      );
      if (!match) return;
      const url = match[0].replace(/[),.;\]]+$/, "");
      setPreviewUrl(url);
      if (!openedUrlsRef.current.has(url)) {
        openedUrlsRef.current.add(url);
        void window.api.openExternal(url);
      }
    });
    return off;
  }, []);

  // ---------- terminales ----------

  function runInActiveTerm(command: string) {
    termRefs.current.get(activeTerm)?.runCommand(command);
  }

  function addTerm() {
    const id = nextTermIdRef.current++;
    setTermIds((prev) => [...prev, id]);
    setActiveTerm(id);
  }

  function closeTerm(id: number) {
    void window.api.termDispose(id);
    termRefs.current.delete(id);
    setTermIds((prev) => {
      const next = prev.filter((t) => t !== id);
      if (activeTerm === id && next.length) setActiveTerm(next[0]);
      return next;
    });
  }

  // ---------- ejecución ----------

  async function handleRunFile() {
    const file = activeRef.current;
    if (!file) {
      setNotice("Abre un archivo primero para poder ejecutarlo.");
      return;
    }
    const { id, label } = getFileLanguage(file);
    const runner = RUNNERS[id];
    if (!runner) {
      setNotice(`No hay un ejecutor configurado para ${label}.`);
      return;
    }
    await saveFile();
    const installed = await window.api.checkTool(runner.tool);
    if (!installed) {
      setMissingTool({ name: runner.name, url: runner.url });
      return;
    }
    runInActiveTerm(runner.cmd(file));
  }

  // corre el proyecto abierto: npm install si falta node_modules
  // y luego el script dev/start/serve del package.json
  async function handleRunProject() {
    if (!rootPath) {
      setNotice("Abre la carpeta de un proyecto primero.");
      return;
    }
    const entries = await window.api.readDir(rootPath);
    const hasPkg = entries.some((e) => e.name === "package.json");
    if (!hasPkg) {
      setNotice(
        "No encontré un package.json en la raíz del proyecto. Usa la terminal para correr otros tipos de proyecto.",
      );
      return;
    }
    const nodeOk = await window.api.checkTool("node");
    if (!nodeOk) {
      setMissingTool({ name: "Node.js", url: "https://nodejs.org/es/download" });
      return;
    }
    let script: string | null = null;
    try {
      const pkg = JSON.parse(
        await window.api.readFile(rootPath + "\\package.json"),
      );
      const scripts = pkg.scripts ?? {};
      script = ["dev", "start", "serve", "preview"].find((s) => scripts[s]) ?? null;
    } catch {
      /* package.json ilegible: intentamos npm start */
    }
    const hasModules = entries.some((e) => e.name === "node_modules");
    const steps: string[] = [];
    if (!hasModules) steps.push("npm install");
    steps.push(script ? `npm run ${script}` : "npm start");
    runInActiveTerm(steps.join("; "));
  }

  // ---------- Git ----------

  // archivos con cambios como rutas relativas a la raíz del proyecto
  const changedFiles = rootPath
    ? Object.entries(gitStatuses).map(([abs, st]) => ({
        rel: abs.slice(rootPath.length + 1),
        st,
      }))
    : [];

  async function openGitPanel() {
    const root = rootRef.current;
    if (!root) {
      setNotice("Abre la carpeta de un proyecto primero.");
      return;
    }
    const info = await window.api.gitInfo(root);
    if (!info.installed) {
      setMissingTool({ name: "Git", url: "https://git-scm.com/downloads" });
      return;
    }
    const statuses = await window.api.gitStatus(root);
    setGitStatuses(statuses);
    // por defecto todos los archivos cambiados entran al commit
    setSelectedFiles(
      new Set(Object.keys(statuses).map((abs) => abs.slice(root.length + 1))),
    );
    setGitBranchList(info.repo ? await window.api.gitBranches(root) : []);
    setSensWarning(null);
    setBranchMode(false);
    setNewBranch("");
    setGitLogList(null);
    setGitInfo(info);
    setRemoteUrl(info.remote ?? "");
    setGitPanel(true);
  }

  // los comandos corren en la terminal integrada para que veas su salida;
  // el `cd` dentro del comando solo afecta a ese proceso, no a tu terminal
  function gitRun(command: string) {
    const root = rootRef.current;
    setGitPanel(false);
    runInActiveTerm(root ? `cd "${root}"; ${command}` : command);
  }

  function gitInit() {
    gitRun("git init");
  }

  function selectedRelFiles(): string[] {
    return changedFiles.filter((f) => selectedFiles.has(f.rel)).map((f) => f.rel);
  }

  function doCommit(files: string[]) {
    const msg = (commitMsg.trim() || "Cambios desde Levitico").replace(/"/g, "'");
    setCommitMsg("");
    setSensWarning(null);
    const addCmd =
      files.length === changedFiles.length
        ? "git add -A"
        : `git add -- ${files.map((f) => `"${f}"`).join(" ")}`;
    gitRun(`${addCmd}; git commit -m "${msg}"`);
  }

  // antes de confirmar se escanean los archivos en busca de API keys,
  // variables de entorno, claves privadas, tokens…
  async function gitCommit() {
    const root = rootRef.current;
    if (!root) return;
    const files = selectedRelFiles();
    if (!files.length) return;
    const findings = await window.api.gitScanSensitive(root, files);
    if (findings.length) {
      setSensWarning(findings);
      return;
    }
    doCommit(files);
  }

  function commitExcludingSensitive() {
    if (!sensWarning) return;
    const bad = new Set(sensWarning.map((w) => w.file));
    const rest = selectedRelFiles().filter((f) => !bad.has(f));
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      bad.forEach((f) => next.delete(f));
      return next;
    });
    if (!rest.length) {
      setSensWarning(null);
      setNotice(
        "Todos los archivos seleccionados contenían información sensible; no quedó nada para confirmar. Agrega esos archivos al .gitignore.",
      );
      return;
    }
    doCommit(rest);
  }

  function gitPush() {
    if (!gitInfo?.branch) return;
    const branch = gitInfo.branch;
    if (gitInfo.remote) {
      gitRun(`git push -u origin ${branch}`);
    } else {
      const url = remoteUrl.trim();
      if (!url) {
        setNotice(
          "Pega la URL del repositorio de GitHub (crea uno vacío en github.com/new y copia la URL que termina en .git).",
        );
        return;
      }
      gitRun(`git remote add origin ${url}; git push -u origin ${branch}`);
    }
  }

  function switchBranch(name: string) {
    if (!name || name === gitInfo?.branch) return;
    gitRun(`git checkout "${name}"`);
  }

  function createBranch() {
    const name = newBranch.trim().replace(/\s+/g, "-");
    if (!name) return;
    setNewBranch("");
    setBranchMode(false);
    gitRun(`git checkout -b "${name}"`);
  }

  async function showGitLog() {
    const root = rootRef.current;
    if (!root) return;
    setGitLogList(await window.api.gitLog(root));
  }

  // ---------- divisores arrastrables ----------

  function startDrag(e: React.MouseEvent, dir: "v" | "h") {
    e.preventDefault();
    setDragging(dir);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sidebarWidth;
    const startH = termHeight;
    document.body.style.cursor = dir === "v" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: MouseEvent) {
      if (dir === "v") {
        const w = Math.min(
          Math.round(window.innerWidth * 0.5),
          Math.max(150, startW + ev.clientX - startX),
        );
        setSidebarWidth(w);
        localStorage.setItem("lv-sidebar-w", String(w));
      } else {
        const h = Math.min(
          Math.round(window.innerHeight * 0.7),
          Math.max(80, startH - (ev.clientY - startY)),
        );
        setTermHeight(h);
        localStorage.setItem("lv-term-h", String(h));
      }
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const langInfo = activeFile ? getFileLanguage(activeFile) : null;
  const isImage = activeFile ? IMAGE_RE.test(activeFile) : false;
  const isMarkdown = langInfo?.id === "markdown";

  return (
    <div className="ide">
      {intro && <IntroScreen onEnter={() => setIntro(false)} />}

      <div className="titlebar" onDoubleClick={() => window.api.winMaximize()}>
        <div className="titlebar-actions">
          <button
            className="tb-btn run"
            title="Ejecutar archivo actual"
            onClick={handleRunFile}
          >
            <svg width="10" height="12" viewBox="0 0 10 12">
              <path d="M1 1.2 L9 6 L1 10.8 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="tb-btn run"
            title="Correr proyecto (npm install + dev)"
            onClick={handleRunProject}
          >
            <svg width="13" height="12" viewBox="0 0 13 12">
              <path d="M1 1.5 L6 6 L1 10.5 Z M6.5 1.5 L11.5 6 L6.5 10.5 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="tb-btn"
            title="Guardar (Ctrl+S)"
            onClick={() => void saveFile()}
            disabled={!activeFile}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 1v6.5M3.5 5.5 6 8l2.5-2.5M1.5 10.5h9" />
            </svg>
          </button>
          <button
            className="tb-btn"
            title="Git · confirmar y subir a GitHub"
            onClick={() => void openGitPanel()}
          >
            <svg
              width="12"
              height="13"
              viewBox="0 0 12 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <circle cx="3" cy="3" r="1.7" />
              <circle cx="3" cy="10" r="1.7" />
              <circle cx="9" cy="4.5" r="1.7" />
              <path d="M3 4.7v3.6M9 6.2c0 2.2-2.8 2.4-4.5 2.5" />
            </svg>
          </button>
          <button
            className="tb-btn"
            title="DevOps · Docker, CI/CD, Terraform, Kubernetes"
            onClick={() => {
              if (!rootPath) setNotice("Abre la carpeta de un proyecto primero.");
              else setDevops(true);
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            >
              <path d="M7 1.5 13 4.5 7 7.5 1 4.5z" />
              <path d="M1 7.5l6 3 6-3" opacity="0.65" />
              <path d="M1 10.5l6 3 6-3" opacity="0.35" />
            </svg>
          </button>
          {previewUrl && (
            <button
              className="tb-btn preview"
              title={`Abrir vista previa · ${previewUrl}`}
              onClick={() => void window.api.openExternal(previewUrl)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              >
                <circle cx="7" cy="7" r="5.5" />
                <path d="M1.5 7h11M7 1.5c2 1.9 2 9.1 0 11-2-1.9-2-9.1 0-11z" />
              </svg>
            </button>
          )}
        </div>
        <div className="titlebar-drag" />
        <div className="win-controls">
          <button
            className="win-btn"
            title="Pantalla completa (F11)"
            onClick={() => window.api.winFullscreen()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 1.5H1.5V4M7 1.5h2.5V4M4 9.5H1.5V7M7 9.5h2.5V7" />
            </svg>
          </button>
          <button
            className="win-btn"
            title="Minimizar"
            onClick={() => window.api.winMinimize()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11">
              <path d="M1.5 5.5h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="win-btn"
            title="Maximizar"
            onClick={() => window.api.winMaximize()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <rect x="1.8" y="1.8" width="7.4" height="7.4" rx="1.4" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </button>
          <button
            className="win-btn close"
            title="Cerrar"
            onClick={() => window.api.winClose()}
          >
            <svg width="11" height="11" viewBox="0 0 11 11">
              <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="main">
        {sidebarVisible && (
          <>
            <div className="sidebar" style={{ width: sidebarWidth }}>
              <div className="side-switch">
                <button
                  className={sidebarView === "files" ? "on" : ""}
                  title="Explorador"
                  onClick={() => setSidebarView("files")}
                >
                  <svg width="13" height="12" viewBox="0 0 16 14" fill="currentColor">
                    <path d="M1.5 3c0-.6.4-1 1-1h3.4l1.5 1.7h6.1c.6 0 1 .4 1 1v6.8c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1z" />
                  </svg>
                </button>
                <button
                  className={sidebarView === "search" ? "on" : ""}
                  title="Buscar en el proyecto (Ctrl+Shift+F)"
                  onClick={() => setSidebarView("search")}
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <circle cx="6" cy="6" r="4.2" />
                    <path d="M9.2 9.2 12.5 12.5" />
                  </svg>
                </button>
              </div>
              <div
                className="side-view"
                style={{ display: sidebarView === "files" ? "flex" : "none" }}
              >
                <FileTree
                  initialRoot={restoredRoot}
                  onFileOpen={handleFileOpen}
                  onFolderOpen={setRootPath}
                  onFolderClose={handleCloseProject}
                  onFsChange={() => void refreshGitStatuses()}
                  onEntryRemoved={closeTab}
                  statuses={gitStatuses}
                />
              </div>
              <div
                className="side-view"
                style={{ display: sidebarView === "search" ? "flex" : "none" }}
              >
                <SearchPanel
                  root={rootPath}
                  onOpenAt={(p, l) => void openFileAt(p, l)}
                  onReplaced={() => void reloadOpenFiles()}
                />
              </div>
            </div>

            <div
              className={`splitter splitter-v ${dragging === "v" ? "dragging" : ""}`}
              onMouseDown={(e) => startDrag(e, "v")}
            />
          </>
        )}

        <div className="editor-area">
          <div className="tabs">
            {openFiles.map((file) => (
              <div
                key={file}
                className={`tab ${file === activeFile ? "active" : ""}`}
                onClick={() => setActiveFile(file)}
              >
                {dirty[file] && <span className="dirty-dot">●</span>}
                <span>{file.split(/[\\/]/).pop()}</span>
                <button
                  className="tab-close"
                  title="Cerrar (Ctrl+W)"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(file);
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
            {isMarkdown && (
              <button
                className={`md-toggle ${mdPreview ? "on" : ""}`}
                title="Vista previa de Markdown"
                onClick={() => setMdPreview((v) => !v)}
              >
                <svg width="13" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path d="M1 5c1.8-2.7 4-4 6-4s4.2 1.3 6 4c-1.8 2.7-4 4-6 4S2.8 7.7 1 5z" />
                  <circle cx="7" cy="5" r="1.7" />
                </svg>
              </button>
            )}
          </div>
          {isImage && activeFile ? (
            <ImageView path={activeFile} />
          ) : isMarkdown && mdPreview && activeFile ? (
            <MarkdownView source={contents[activeFile] ?? ""} />
          ) : (
            <Editor
              filePath={activeFile}
              content={activeFile ? contents[activeFile] ?? null : null}
              onChange={(value) => {
                const path = activeRef.current;
                if (!path) return;
                setContents((prev) => ({ ...prev, [path]: value }));
                setDirty((prev) => ({ ...prev, [path]: true }));
                if (autoSaveRef.current) {
                  window.clearTimeout(autosaveTimerRef.current);
                  autosaveTimerRef.current = window.setTimeout(
                    () => void saveFilePath(path),
                    800,
                  );
                }
              }}
              onSave={() => void saveFile()}
              onCursorChange={(line, col) => setCursor({ line, col })}
              onReady={(editor) => {
                editorRef.current = editor;
              }}
            />
          )}
        </div>
      </div>

      <div
        className={`splitter splitter-h ${dragging === "h" ? "dragging" : ""}`}
        onMouseDown={(e) => startDrag(e, "h")}
      />

      <div className="bottom" style={{ height: termHeight }}>
        <div className="panel-tabs">
          {termIds.map((id, i) => (
            <span
              key={id}
              className={`panel-tab ${id === activeTerm ? "active" : ""}`}
              onClick={() => setActiveTerm(id)}
            >
              Terminal {i + 1}
              {termIds.length > 1 && (
                <button
                  className="term-close"
                  title="Cerrar terminal"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerm(id);
                  }}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button className="term-add" title="Nueva terminal" onClick={addTerm}>
            +
          </button>
        </div>
        <div className="terminal">
          {termIds.map((id) => (
            <div
              key={id}
              className="term-slot"
              style={{ display: id === activeTerm ? "block" : "none" }}
            >
              <Terminal
                sessionId={id}
                cwd={rootPath}
                ref={(handle) => {
                  if (handle) termRefs.current.set(id, handle);
                  else termRefs.current.delete(id);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="statusbar">
        {langInfo && (
          <span className="status-item accent">{langInfo.label}</span>
        )}
        <span className="status-item">
          Ln {cursor.line}, Col {cursor.col}
        </span>
        {activeFile && dirty[activeFile] && (
          <span className="status-item">● sin guardar</span>
        )}
        <button
          className={`auto-toggle ${autoSave ? "on" : ""}`}
          title="Autoguardado"
          onClick={() => setAutoSave((v) => !v)}
        >
          AUTO
        </button>
        <StatusExtras />
        <span className="status-item">Levitico v0.2.0</span>
      </div>

      {quickOpen && (
        <QuickOpen
          root={rootPath}
          onClose={() => setQuickOpen(false)}
          onPick={(p) => void handleFileOpen(p)}
        />
      )}

      {devops && rootPath && (
        <DevOpsPanel
          root={rootPath}
          onClose={() => setDevops(false)}
          runInTerminal={(cmd) => runInActiveTerm(`cd "${rootPath}"; ${cmd}`)}
          onNotice={setNotice}
        />
      )}

      {closeConfirm && (
        <div className="modal-overlay">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Cambios sin guardar</div>
            <div className="modal-body">
              Tienes archivos con cambios sin guardar. ¿Qué quieres hacer?
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn primary"
                onClick={() => {
                  void saveAll().then(() => window.api.confirmClose());
                }}
              >
                Guardar todo y salir
              </button>
              <button
                className="modal-btn"
                onClick={() => window.api.confirmClose()}
              >
                Salir sin guardar
              </button>
              <button
                className="modal-btn"
                onClick={() => setCloseConfirm(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {missingTool && (
        <div className="modal-overlay" onClick={() => setMissingTool(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Herramienta no encontrada</div>
            <div className="modal-body">
              Para ejecutar este archivo necesitas{" "}
              <strong>{missingTool.name}</strong> y no está instalado en tu
              sistema.
            </div>
            <div className="modal-actions">
              <button
                className="modal-btn primary"
                onClick={() => {
                  void window.api.openExternal(missingTool.url);
                  setMissingTool(null);
                }}
              >
                Descargar {missingTool.name} ↗
              </button>
              <button
                className="modal-btn"
                onClick={() => setMissingTool(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {gitPanel && gitInfo && (
        <div className="modal-overlay" onClick={() => setGitPanel(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {!gitInfo.repo ? (
              <>
                <div className="modal-title">Git</div>
                <div className="modal-body">
                  Esta carpeta todavía no es un repositorio de Git.
                </div>
                <div className="modal-actions">
                  <button className="modal-btn primary" onClick={gitInit}>
                    Inicializar repositorio
                  </button>
                  <button className="modal-btn" onClick={() => setGitPanel(false)}>
                    Cancelar
                  </button>
                </div>
              </>
            ) : gitLogList ? (
              <>
                <div className="modal-title">Historial de commits</div>
                <div className="modal-body">
                  <div className="git-log">
                    {gitLogList.map((c) => (
                      <div key={c.hash} className="git-log-item">
                        <span className="git-hash">{c.hash}</span>
                        <span className="git-msg">{c.msg}</span>
                      </div>
                    ))}
                    {!gitLogList.length && "Sin commits todavía."}
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="modal-btn" onClick={() => setGitLogList(null)}>
                    ← Volver
                  </button>
                </div>
              </>
            ) : sensWarning ? (
              <>
                <div className="modal-title sens-title">
                  ⚠ Información sensible detectada
                </div>
                <div className="modal-body">
                  Estos archivos parecen contener credenciales y estaban por
                  entrar al commit:
                  <div className="sens-list">
                    {sensWarning.map((w) => (
                      <div key={w.file} className="sens-item">
                        <span className="sens-file">{w.file}</span>
                        <span className="sens-reason">{w.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    className="modal-btn primary"
                    onClick={commitExcludingSensitive}
                  >
                    Excluir y confirmar
                  </button>
                  <button
                    className="modal-btn"
                    onClick={() => doCommit(selectedRelFiles())}
                  >
                    Confirmar de todos modos
                  </button>
                  <button
                    className="modal-btn"
                    onClick={() => setSensWarning(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-title">Git</div>
                <div className="modal-body">
                  <div className="git-branch-row">
                    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <circle cx="3" cy="3" r="1.7" />
                      <circle cx="3" cy="10" r="1.7" />
                      <circle cx="9" cy="4.5" r="1.7" />
                      <path d="M3 4.7v3.6M9 6.2c0 2.2-2.8 2.4-4.5 2.5" />
                    </svg>
                    <select
                      className="modal-select"
                      value={gitInfo.branch}
                      onChange={(e) => switchBranch(e.target.value)}
                    >
                      {(gitBranchList.length ? gitBranchList : [gitInfo.branch]).map(
                        (b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ),
                      )}
                    </select>
                    <button
                      className="modal-btn mini"
                      title="Crear rama nueva"
                      onClick={() => setBranchMode((v) => !v)}
                    >
                      +
                    </button>
                    <button
                      className="modal-btn mini"
                      title="git pull"
                      onClick={() => gitRun("git pull")}
                    >
                      ⇣
                    </button>
                    <button
                      className="modal-btn mini"
                      title="Historial de commits"
                      onClick={() => void showGitLog()}
                    >
                      ≡
                    </button>
                  </div>
                  {branchMode && (
                    <input
                      autoFocus
                      className="modal-input"
                      placeholder="nombre de la rama nueva…"
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") createBranch();
                        if (e.key === "Escape") setBranchMode(false);
                      }}
                    />
                  )}

                  {changedFiles.length ? (
                    <div className="git-files">
                      {changedFiles.map((f) => (
                        <label key={f.rel} className="git-file">
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(f.rel)}
                            onChange={() =>
                              setSelectedFiles((prev) => {
                                const next = new Set(prev);
                                if (next.has(f.rel)) next.delete(f.rel);
                                else next.add(f.rel);
                                return next;
                              })
                            }
                          />
                          <span className="gf-name">{f.rel}</span>
                          <span className={`gf-badge st-${f.st}`}>{f.st}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    "No hay cambios pendientes."
                  )}

                  {gitInfo.remote ? (
                    <div className="git-remote" title={gitInfo.remote}>
                      ⇄ {gitInfo.remote}
                    </div>
                  ) : (
                    <input
                      className="modal-input"
                      placeholder="URL del repo de GitHub (https://github.com/usuario/repo.git)"
                      value={remoteUrl}
                      onChange={(e) => setRemoteUrl(e.target.value)}
                    />
                  )}
                  <input
                    className="modal-input"
                    placeholder="Mensaje del commit…"
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void gitCommit();
                    }}
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="modal-btn"
                    onClick={() => void gitCommit()}
                    disabled={!selectedFiles.size}
                  >
                    Confirmar ({selectedFiles.size})
                  </button>
                  <button className="modal-btn primary" onClick={gitPush}>
                    Subir a GitHub ↗
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div className="modal-overlay" onClick={() => setNotice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Aviso</div>
            <div className="modal-body">{notice}</div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setNotice(null)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
