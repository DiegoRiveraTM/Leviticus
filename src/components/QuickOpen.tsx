import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  root: string | null;
  onClose: () => void;
  onPick: (absPath: string) => void;
}

// coincidencia difusa simple: las letras de la consulta deben aparecer en orden
function fuzzyScore(target: string, query: string): number {
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 1;
  const name = t.split(/[\\/]/).pop() ?? t;
  if (name.includes(q)) return 100 - name.indexOf(q);
  if (t.includes(q)) return 50 - Math.min(40, t.indexOf(q));
  let ti = 0;
  for (const ch of q) {
    ti = t.indexOf(ch, ti);
    if (ti === -1) return -1;
    ti++;
  }
  return 10;
}

export default function QuickOpen({ root, onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root) return;
    void window.api.listFiles(root).then(setFiles);
  }, [root]);

  const matches = useMemo(() => {
    return files
      .map((f) => ({ f, s: fuzzyScore(f, query) }))
      .filter((m) => m.s >= 0)
      .sort((a, b) => b.s - a.s || a.f.length - b.f.length)
      .slice(0, 50)
      .map((m) => m.f);
  }, [files, query]);

  useEffect(() => setSel(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(".qo-item.sel")
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function pick(rel: string) {
    if (!root) return;
    onPick(root + "\\" + rel);
    onClose();
  }

  return (
    <div className="qo-overlay" onClick={onClose}>
      <div className="qo-box" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="qo-input"
          placeholder="Buscar archivo por nombre…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(s + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(s - 1, 0));
            } else if (e.key === "Enter" && matches[sel]) {
              pick(matches[sel]);
            }
          }}
        />
        <div className="qo-list" ref={listRef}>
          {matches.map((f, i) => {
            const name = f.split(/[\\/]/).pop();
            const dir = f.slice(0, f.length - (name?.length ?? 0));
            return (
              <div
                key={f}
                className={`qo-item ${i === sel ? "sel" : ""}`}
                onClick={() => pick(f)}
                onMouseEnter={() => setSel(i)}
              >
                <span className="qo-name">{name}</span>
                {dir && <span className="qo-dir">{dir}</span>}
              </div>
            );
          })}
          {!matches.length && (
            <div className="qo-empty">Sin coincidencias</div>
          )}
        </div>
      </div>
    </div>
  );
}
