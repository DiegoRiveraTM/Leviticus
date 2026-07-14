import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import RacingBorder from "./RacingBorder";
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

function parentOf(p: string) {
  return p.replace(/[\\/][^\\/]+$/, "");
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

function FileIcon() {
  return (
    <svg
      className="ft-icon"
      width="11"
      height="13"
      viewBox="0 0 11 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
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
  setActiveFolder: (path: string) => void;
  onFileOpen: (path: string) => void;
  onContext: (entry: FileEntry, x: number, y: number) => void;
  statuses: Record<string, string>;
}

function TreeNode({
  entry,
  depth,
  version,
  activeFolder,
  setActiveFolder,
  onFileOpen,
  onContext,
  statuses,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);

  // cuando algo cambió en el disco (crear/renombrar/borrar) se re-lee
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

  if (entry.isDirectory) {
    const isActive = activeFolder === entry.path;
    const prefix = entry.path + "\\";
    const hasChanges = Object.keys(statuses).some((p) => p.startsWith(prefix));
    return (
      <>
        <div
          className={`ft-folder ${isActive ? "active" : ""}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={toggle}
          onContextMenu={handleContext}
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
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              version={version}
              activeFolder={activeFolder}
              setActiveFolder={setActiveFolder}
              onFileOpen={onFileOpen}
              onContext={onContext}
              statuses={statuses}
            />
          ))}
      </>
    );
  }

  const status = statuses[entry.path];
  const statusClass = status ? STATUS_CLASS[status] ?? "" : "";
  return (
    <div
      className="ft-file"
      style={{ paddingLeft: 22 + depth * 12 }}
      onClick={toggle}
      onContextMenu={handleContext}
    >
      <FileIcon />
      <span className={`ft-name ${statusClass}`}>{entry.name}</span>
      {status && <span className={`ft-badge ${statusClass}`}>{status}</span>}
    </div>
  );
}

type EditState =
  | { mode: "create-file" | "create-dir" | "create-root"; base: string }
  | { mode: "rename"; entry: FileEntry }
  | null;

interface Props {
  onFileOpen: (path: string) => void;
  onFolderOpen?: (path: string) => void;
  onFolderClose?: () => void;
  onFsChange?: () => void;
  onEntryRemoved?: (path: string) => void;
  statuses?: Record<string, string>;
}

export default function FileTree({
  onFileOpen,
  onFolderOpen,
  onFolderClose,
  onFsChange,
  onEntryRemoved,
  statuses = {},
}: Props) {
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
  } | null>(null);
  const [edit, setEdit] = useState<EditState>(null);
  const [editName, setEditName] = useState("");

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

  // carpeta destino: la del clic derecho, el padre si fue un archivo,
  // o la carpeta activa / raíz si fue en el fondo
  function baseFor(entry: FileEntry | null): string | null {
    if (entry) return entry.isDirectory ? entry.path : parentOf(entry.path);
    return activeFolder ?? rootPath;
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

  async function doDelete() {
    const entry = ctxMenu?.entry;
    setCtxMenu(null);
    if (!entry) return;
    if (!window.confirm(`¿Enviar "${entry.name}" a la papelera?`)) return;
    const ok = await window.api.deletePath(entry.path);
    if (ok) {
      onEntryRemoved?.(entry.path);
      bump();
    }
  }

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
      <div className="filetree-header">
        <span className="filetree-title" title={rootPath ?? undefined}>
          {rootPath ? lastSegment(rootPath) : "Explorer"}
        </span>
        <div className="filetree-actions">
          {rootPath && (
            <>
              <button
                className="open-btn"
                title="Nuevo archivo"
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
                title="Nueva carpeta"
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
          <button className="open-btn" title="Abrir carpeta" onClick={openFolder}>
            ⊕
          </button>
          {rootPath && (
            <button
              className="open-btn close-btn"
              title="Cerrar proyecto"
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
                placeholder={`nueva carpeta en ${lastSegment(edit.base)}/`}
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
                Open folder
              </div>
              <div
                className="filetree-empty secondary"
                onClick={() => void createProjectFolder()}
              >
                + Crear carpeta de proyecto
              </div>
            </>
          )}
        </>
      ) : (
        <div
          className="filetree-entries"
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, entry: null });
          }}
        >
          {edit && (
            <div className="ft-edit-row">
              {edit.mode === "create-dir" ? <FolderIcon open={false} /> : <FileIcon />}
              <input
                autoFocus
                className="ft-edit-input"
                placeholder={
                  edit.mode === "rename"
                    ? "nuevo nombre…"
                    : `${edit.mode === "create-dir" ? "carpeta" : "archivo"} en ${lastSegment(edit.base)}/`
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
              statuses={statuses}
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
              top: Math.min(ctxMenu.y, window.innerHeight - 150),
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {ctxMenu.entry && (
              <div className="ctx-label">{ctxMenu.entry.name}</div>
            )}
            <div className="ctx-item" onClick={() => startCreate("create-file")}>
              Nuevo archivo…
            </div>
            <div className="ctx-item" onClick={() => startCreate("create-dir")}>
              Nueva carpeta…
            </div>
            {ctxMenu.entry && (
              <>
                <div className="ctx-sep" />
                <div className="ctx-item" onClick={startRename}>
                  Renombrar…
                </div>
                <div className="ctx-item danger" onClick={() => void doDelete()}>
                  Eliminar (a la papelera)
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
