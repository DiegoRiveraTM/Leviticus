import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RacingBorder from "./RacingBorder";
import { useT } from "../i18n";
import "./FileTree.css";

interface FileEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

// letra de git → clase de color (como VS Code: U verde, M naranja, D rojo)
const STATUS_CLASS: Record<string, string> = {
  U: "git-added",
  A: "git-added",
  M: "git-modified",
  R: "git-modified",
  D: "git-deleted",
};

// color del icono según el tipo de archivo
const EXT_COLORS: Record<string, string> = {
  ts: "#4a9eff", tsx: "#4a9eff", mts: "#4a9eff", cts: "#4a9eff",
  js: "#e8d44d", jsx: "#e8d44d", mjs: "#e8d44d", cjs: "#e8d44d",
  py: "#5ba0d0", pyw: "#5ba0d0",
  html: "#e5734f", htm: "#e5734f",
  css: "#9d7bff", scss: "#e463a8", sass: "#e463a8", less: "#9d7bff",
  json: "#e8d44d", jsonc: "#e8d44d",
  md: "#8ec2ff", mdx: "#8ec2ff",
  yml: "#b18cff", yaml: "#b18cff", toml: "#b18cff", ini: "#b18cff",
  java: "#e88f4d", kt: "#b18cff", scala: "#e0524f",
  c: "#7aa2f7", h: "#7aa2f7", cpp: "#7aa2f7", cc: "#7aa2f7", hpp: "#7aa2f7",
  cs: "#9b7bff", go: "#4dc9d8", rs: "#e0805c",
  php: "#8892bf", rb: "#e0524f",
  vue: "#42b883", svelte: "#ff5d3e", astro: "#ff7d54",
  sh: "#7fd88f", bash: "#7fd88f", ps1: "#7fd88f", psm1: "#7fd88f",
  bat: "#7fd88f", cmd: "#7fd88f",
  sql: "#e8a44d",
  png: "#d29ee8", jpg: "#d29ee8", jpeg: "#d29ee8", gif: "#d29ee8",
  svg: "#d29ee8", webp: "#d29ee8", ico: "#d29ee8",
  env: "#e3b341",
  tf: "#8c6fe8", tfvars: "#8c6fe8",
};

function iconColor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === "dockerfile") return "#4dc9d8";
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return EXT_COLORS[ext] ?? "rgba(230, 240, 255, 0.35)";
}

function parentOf(p: string) {
  return p.replace(/[\\/][^\\/]+$/, "");
}

// ¿la ruta está ignorada por git? (la propia carpeta .git también cuenta,
// aunque git no la reporte en status --ignored)
function isIgnoredPath(p: string, name: string, ignored: string[]): boolean {
  if (name === ".git" || p.includes("\\.git\\")) return true;
  return ignored.some((ig) => p === ig || p.startsWith(ig + "\\"));
}

function lastSegment(p: string) {
  return p.split(/[\\/]/).pop() ?? p;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`ft-chevron ${open ? "open" : ""}`}
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 1l3 3-3 3" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className="ft-icon" width="14" height="12" viewBox="0 0 16 14">
      <path
        d={
          open
            ? "M1.5 3c0-.6.4-1 1-1h3.4l1.5 1.7h6.1c.6 0 1 .4 1 1v.8H3.6c-.5 0-.9.3-1 .8L1.5 11z M1.7 12.5c-.6 0-1-.5-.8-1.1l1.5-5c.1-.4.5-.7 1-.7h11.2c.6 0 1.1.6.9 1.2l-1.4 4.9c-.1.4-.5.7-1 .7z"
            : "M1.5 3c0-.6.4-1 1-1h3.4l1.5 1.7h6.1c.6 0 1 .4 1 1v6.8c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

function FileIcon({ name }: { name?: string }) {
  return (
    <svg
      className="ft-icon"
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      stroke={name ? iconColor(name) : "currentColor"}
      strokeWidth="1.2"
      strokeLinejoin="round"
    >
      <path d="M1.5 1.5h5L9.5 4.5v7h-8z" />
      <path d="M6.5 1.5v3h3" />
    </svg>
  );
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  version: number;
  activeFolder: string | null;
  setActiveFolder: (path: string | null) => void;
  onFileOpen: (path: string) => void;
  onContext: (entry: FileEntry, x: number, y: number) => void;
  onMove: (src: string, targetDir: string) => void;
  dropTarget: string | null;
  setDropTarget: (path: string | null) => void;
  statuses: Record<string, string>;
  ignored: string[];
}

function TreeNode(props: TreeNodeProps) {
  const {
    entry,
    depth,
    version,
    activeFolder,
    setActiveFolder,
    onFileOpen,
    onContext,
    onMove,
    dropTarget,
    setDropTarget,
    statuses,
    ignored,
  } = props;
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);

  // cuando algo cambió en el disco (crear/renombrar/borrar/mover) se re-lee
  // el contenido de las carpetas expandidas sin perder la expansión
  useEffect(() => {
    if (expanded) void window.api.readDir(entry.path).then(setChildren);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function toggle() {
    if (!entry.isDirectory) {
      onFileOpen(entry.path);
      return;
    }
    setActiveFolder(entry.path);
    if (!expanded) {
      const contents = await window.api.readDir(entry.path);
      setChildren(contents);
    }
    setExpanded((prev) => !prev);
  }

  function handleContext(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContext(entry, e.clientX, e.clientY);
  }

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation();
    e.dataTransfer.setData("text/lev-path", entry.path);
    e.dataTransfer.effectAllowed = "move";
  }

  const entryIgnored = isIgnoredPath(entry.path, entry.name, ignored);

  if (entry.isDirectory) {
    const isActive = activeFolder === entry.path;
    const prefix = entry.path + "\\";
    const hasChanges =
      !entryIgnored &&
      Object.keys(statuses).some((p) => p.startsWith(prefix));
    return (
      <>
        <div
          className={`ft-folder ${isActive ? "active" : ""} ${dropTarget === entry.path ? "drop" : ""} ${entryIgnored ? "ft-ignored" : ""}`}
          title={entryIgnored ? t("ft.ignoredTip") : undefined}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={toggle}
          onContextMenu={handleContext}
          draggable
          onDragStart={handleDragStart}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/lev-path")) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "move";
              setDropTarget(entry.path);
            }
          }}
          onDragLeave={() => {
            if (dropTarget === entry.path) setDropTarget(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropTarget(null);
            const src = e.dataTransfer.getData("text/lev-path");
            if (src) onMove(src, entry.path);
          }}
        >
          <ChevronIcon open={expanded} />
          <FolderIcon open={expanded} />
          <span className={`ft-name ${hasChanges ? "git-dirty" : ""}`}>
            {entry.name}
          </span>
          {hasChanges && <span className="ft-badge git-dirty">●</span>}
          <RacingBorder active={isActive} />
        </div>
        {expanded &&
          children.map((child) => (
            <TreeNode key={child.path} {...props} entry={child} depth={depth + 1} />
          ))}
      </>
    );
  }

  const status = entryIgnored ? undefined : statuses[entry.path];
  const statusClass = status ? STATUS_CLASS[status] ?? "" : "";
  const fileDir = parentOf(entry.path);
  return (
    <div
      className={`ft-file ${entryIgnored ? "ft-ignored" : ""}`}
      title={entryIgnored ? t("ft.ignoredTip") : undefined}
      style={{ paddingLeft: 22 + depth * 12 }}
      onClick={toggle}
      onContextMenu={handleContext}
      draggable
      onDragStart={handleDragStart}
      // soltar sobre un archivo lo mueve a la carpeta de ese archivo: así
      // se puede sacar algo de una carpeta aunque no haya espacio vacío
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("text/lev-path")) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          setDropTarget(fileDir);
        }
      }}
      onDragLeave={() => {
        if (dropTarget === fileDir) setDropTarget(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDropTarget(null);
        const src = e.dataTransfer.getData("text/lev-path");
        if (src) onMove(src, fileDir);
      }}
    >
      <FileIcon name={entry.name} />
      <span className={`ft-name ${statusClass}`}>{entry.name}</span>
      {status && <span className={`ft-badge ${statusClass}`}>{status}</span>}
      {entryIgnored && <span className="ft-badge ft-ignored-badge">⊘</span>}
    </div>
  );
}

type EditState =
  | { mode: "create-file" | "create-dir" | "create-root"; base: string }
  | { mode: "rename"; entry: FileEntry }
  | null;

interface Props {
  initialRoot?: string | null;
  onFileOpen: (path: string) => void;
  onFolderOpen?: (path: string) => void;
  onFolderClose?: () => void;
  onFsChange?: () => void;
  onEntryRemoved?: (path: string) => void;
  statuses?: Record<string, string>;
  ignored?: string[];
}

export default function FileTree({
  initialRoot,
  onFileOpen,
  onFolderOpen,
  onFolderClose,
  onFsChange,
  onEntryRemoved,
  statuses = {},
  ignored = [],
}: Props) {
  const { t } = useT();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
  } | null>(null);
  const [edit, setEdit] = useState<EditState>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);

  // restaurar el proyecto de la sesión anterior
  useEffect(() => {
    if (!initialRoot || rootPath) return;
    void window.api
      .readDir(initialRoot)
      .then((contents) => {
        setRootPath(initialRoot);
        setEntries(contents);
      })
      .catch(() => {
        /* la carpeta ya no existe */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoot]);

  async function openFolder() {
    const folder = await window.api.openFolder();
    if (!folder) return;
    setRootPath(folder);
    onFolderOpen?.(folder);
    const contents = await window.api.readDir(folder);
    setEntries(contents);
  }

  function closeFolder() {
    setRootPath(null);
    setEntries([]);
    setActiveFolder(null);
    onFolderClose?.();
  }

  // refresca la raíz cuando cambia algo en el disco
  useEffect(() => {
    if (rootPath) void window.api.readDir(rootPath).then(setEntries);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  // cambios hechos fuera del explorador (panel DevOps, comandos de la
  // terminal, otros editores): el watcher del main avisa y se re-lee todo
  useEffect(() => {
    const off = window.api.onFsChanged(() => setVersion((v) => v + 1));
    return off;
  }, []);

  // el menú contextual se cierra al hacer clic en cualquier otro lado
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
    };
  }, [ctxMenu]);

  function bump() {
    setVersion((v) => v + 1);
    onFsChange?.();
  }

  // mover con drag & drop
  async function moveEntry(src: string, targetDir: string) {
    if (!src || src === targetDir) return;
    if (targetDir === src || targetDir.startsWith(src + "\\")) return; // dentro de sí misma
    if (parentOf(src) === targetDir) return; // ya está ahí
    const dest = targetDir + "\\" + lastSegment(src);
    const ok = await window.api.renamePath(src, dest);
    if (ok) {
      onEntryRemoved?.(src);
      bump();
    }
  }

  // carpeta destino: la del clic derecho, el padre si fue un archivo,
  // o la raíz si el clic derecho fue en el fondo vacío
  function baseFor(entry: FileEntry | null): string | null {
    if (entry) return entry.isDirectory ? entry.path : parentOf(entry.path);
    return rootPath;
  }

  function startCreate(mode: "create-file" | "create-dir") {
    const base = baseFor(ctxMenu?.entry ?? null);
    setCtxMenu(null);
    if (!base) return;
    setEdit({ mode, base });
    setEditName("");
  }

  // sin proyecto abierto: elige dónde y crea una carpeta nueva que
  // se abre como raíz del proyecto
  async function createProjectFolder() {
    const parent = await window.api.openFolder();
    if (!parent) return;
    setEdit({ mode: "create-root", base: parent });
    setEditName("");
  }

  function startRename() {
    const entry = ctxMenu?.entry;
    if (!entry) return;
    setEdit({ mode: "rename", entry });
    setEditName(entry.name);
    setCtxMenu(null);
  }

  // el clic derecho solo abre la confirmación; el borrado real va aparte
  function doDelete() {
    const entry = ctxMenu?.entry;
    setCtxMenu(null);
    if (entry) setConfirmDelete(entry);
  }

  async function reallyDelete() {
    const entry = confirmDelete;
    if (!entry) return;
    setConfirmDelete(null);
    const ok = await window.api.deletePath(entry.path);
    if (ok) {
      onEntryRemoved?.(entry.path);
      bump();
    }
  }

  // Escape cierra la confirmación (Enter la acepta vía el botón enfocado)
  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDelete]);

  async function confirmEdit() {
    if (!edit) return;
    const name = editName.trim();
    if (!name) {
      setEdit(null);
      return;
    }
    if (edit.mode === "rename") {
      const target = parentOf(edit.entry.path) + "\\" + name;
      if (target !== edit.entry.path) {
        const ok = await window.api.renamePath(edit.entry.path, target);
        if (ok) onEntryRemoved?.(edit.entry.path);
      }
    } else if (edit.mode === "create-root") {
      const target = edit.base + "\\" + name;
      const ok = await window.api.createDir(target);
      if (ok) {
        setRootPath(target);
        onFolderOpen?.(target);
        setEntries([]);
      }
    } else {
      const target = edit.base + "\\" + name;
      const ok =
        edit.mode === "create-file"
          ? await window.api.createFile(target)
          : await window.api.createDir(target);
      if (ok && edit.mode === "create-file") onFileOpen(target);
    }
    setEdit(null);
    setEditName("");
    bump();
  }

  return (
    <div className="filetree">
      <div
        className="filetree-header"
        // soltar en el encabezado del proyecto = mover a la raíz
        onDragOver={(e) => {
          if (rootPath && e.dataTransfer.types.includes("text/lev-path")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(null);
          const src = e.dataTransfer.getData("text/lev-path");
          if (src && rootPath) void moveEntry(src, rootPath);
        }}
      >
        <span className="filetree-title" title={rootPath ?? undefined}>
          {rootPath ? lastSegment(rootPath) : "Explorer"}
        </span>
        <div className="filetree-actions">
          {rootPath && (
            <>
              <button
                className="open-btn"
                title={t("ft.tipNewFile")}
                onClick={() => {
                  setEdit({ mode: "create-file", base: activeFolder ?? rootPath });
                  setEditName("");
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
                  <path d="M2.5 1.5h5l3 3v8h-8z" />
                  <path d="M7.5 1.5v3h3" />
                  <path d="M5.5 9h3M7 7.5v3" strokeLinecap="round" />
                </svg>
              </button>
              <button
                className="open-btn"
                title={t("ft.tipNewFolder")}
                onClick={() => {
                  setEdit({ mode: "create-dir", base: activeFolder ?? rootPath });
                  setEditName("");
                }}
              >
                <svg width="14" height="12" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
                  <path d="M1.5 3c0-.6.4-1 1-1h3.4l1.5 1.7h6.1c.6 0 1 .4 1 1v6.8c0 .6-.4 1-1 1h-11c-.6 0-1-.4-1-1z" />
                  <path d="M8 6.2v3.6M6.2 8h3.6" strokeLinecap="round" />
                </svg>
              </button>
            </>
          )}
          <button
            className="open-btn"
            title={t("ft.tipOpenFolder")}
            onClick={openFolder}
          >
            ⊕
          </button>
          {rootPath && (
            <button
              className="open-btn close-btn"
              title={t("ft.tipCloseProject")}
              onClick={closeFolder}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!rootPath ? (
        <>
          {edit?.mode === "create-root" ? (
            <div className="ft-edit-row">
              <FolderIcon open={false} />
              <input
                autoFocus
                className="ft-edit-input"
                placeholder={`${t("ft.phNewRoot")} ${lastSegment(edit.base)}/`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmEdit();
                  if (e.key === "Escape") setEdit(null);
                }}
                onBlur={() => setEdit(null)}
              />
            </div>
          ) : (
            <>
              <div className="filetree-empty" onClick={openFolder}>
                {t("ft.openFolder")}
              </div>
              <div
                className="filetree-empty secondary"
                onClick={() => void createProjectFolder()}
              >
                {t("ft.createProject")}
              </div>
            </>
          )}
        </>
      ) : (
        <div
          className="filetree-entries"
          onClick={(e) => {
            // clic en el fondo vacío: se quita la selección de carpeta para
            // que los botones de crear vuelvan a apuntar a la raíz
            if (e.target === e.currentTarget) setActiveFolder(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, entry: null });
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/lev-path")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDropTarget(null);
            const src = e.dataTransfer.getData("text/lev-path");
            if (src && rootPath) void moveEntry(src, rootPath);
          }}
        >
          {edit && edit.mode !== "create-root" && (
            <div className="ft-edit-row">
              {edit.mode === "create-dir" ? <FolderIcon open={false} /> : <FileIcon />}
              <input
                autoFocus
                className="ft-edit-input"
                placeholder={
                  edit.mode === "rename"
                    ? t("ft.phRename")
                    : `${edit.mode === "create-dir" ? t("ft.wordFolder") : t("ft.wordFile")} ${t("ft.in")} ${lastSegment(edit.base)}/`
                }
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmEdit();
                  if (e.key === "Escape") setEdit(null);
                }}
                onBlur={() => setEdit(null)}
              />
            </div>
          )}
          {entries.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              version={version}
              activeFolder={activeFolder}
              setActiveFolder={setActiveFolder}
              onFileOpen={onFileOpen}
              onContext={(en, x, y) => setCtxMenu({ x, y, entry: en })}
              onMove={(src, dir) => void moveEntry(src, dir)}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
              statuses={statuses}
              ignored={ignored}
            />
          ))}
        </div>
      )}

      {ctxMenu &&
        createPortal(
          <div
            className="ctx-menu"
            style={{
              left: Math.min(ctxMenu.x, window.innerWidth - 190),
              top: Math.min(ctxMenu.y, window.innerHeight - 170),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ctxMenu.entry && (
              <div className="ctx-label">{ctxMenu.entry.name}</div>
            )}
            <div className="ctx-item" onClick={() => startCreate("create-file")}>
              {t("ft.ctxNewFile")}
            </div>
            <div className="ctx-item" onClick={() => startCreate("create-dir")}>
              {t("ft.ctxNewFolder")}
            </div>
            {ctxMenu.entry && (
              <>
                <div className="ctx-sep" />
                <div className="ctx-item" onClick={startRename}>
                  {t("ft.ctxRename")}
                </div>
                <div className="ctx-item danger" onClick={doDelete}>
                  {t("ft.ctxDelete")}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}

      {confirmDelete &&
        createPortal(
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-title del-title">
                <svg
                  width="14"
                  height="15"
                  viewBox="0 0 14 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1.5 3.5h11M5.5 1.5h3M2.5 3.5l.8 9c.05.6.5 1 1.1 1h5.2c.6 0 1.05-.4 1.1-1l.8-9" />
                  <path d="M5.5 6.5v4M8.5 6.5v4" />
                </svg>
                {t("del.title")}
              </div>
              <div className="modal-body">
                <div className="del-target">
                  {confirmDelete.isDirectory ? (
                    <FolderIcon open={false} />
                  ) : (
                    <FileIcon name={confirmDelete.name} />
                  )}
                  <span className="del-name" title={confirmDelete.path}>
                    {confirmDelete.name}
                  </span>
                </div>
                {confirmDelete.isDirectory
                  ? t("del.folderBody")
                  : t("del.fileBody")}{" "}
                {t("del.restore")}
              </div>
              <div className="modal-actions">
                <button
                  autoFocus
                  className="modal-btn danger"
                  onClick={() => void reallyDelete()}
                >
                  {t("del.confirm")}
                </button>
                <button
                  className="modal-btn"
                  onClick={() => setConfirmDelete(null)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
