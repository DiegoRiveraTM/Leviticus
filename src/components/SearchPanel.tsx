import { useEffect, useMemo, useRef, useState } from "react";

interface Match {
  file: string;
  line: number;
  text: string;
}

interface Props {
  root: string | null;
  onOpenAt: (absPath: string, line: number) => void;
  onReplaced: () => void;
}

export default function SearchPanel({ root, onOpenAt, onReplaced }: Props) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number>();

  async function runSearch(q: string) {
    if (!root || !q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      setResults(await window.api.searchInFiles(root, q));
    } finally {
      setSearching(false);
    }
  }

  // búsqueda con debounce mientras escribes
  useEffect(() => {
    window.clearTimeout(timerRef.current);
    setMessage(null);
    timerRef.current = window.setTimeout(() => void runSearch(query), 450);
    return () => window.clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, root]);

  async function replaceAll() {
    if (!root || !query.trim()) return;
    const total = results.length;
    if (
      !window.confirm(
        `¿Reemplazar ${total} coincidencia(s) de "${query}" por "${replacement}" en todo el proyecto?`,
      )
    )
      return;
    const count = await window.api.searchReplace(root, query, replacement);
    setMessage(`✓ ${count} reemplazo(s) hechos`);
    onReplaced();
    void runSearch(query);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const r of results) {
      const list = map.get(r.file) ?? [];
      list.push(r);
      map.set(r.file, list);
    }
    return [...map.entries()];
  }, [results]);

  function highlight(text: string) {
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark>{text.slice(i, i + query.length)}</mark>
        {text.slice(i + query.length)}
      </>
    );
  }

  if (!root) {
    return (
      <div className="search-panel">
        <div className="sp-empty">Abre un proyecto para buscar en sus archivos.</div>
      </div>
    );
  }

  return (
    <div className="search-panel">
      <input
        id="global-search-input"
        className="sp-input"
        placeholder="Buscar en el proyecto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void runSearch(query);
        }}
      />
      <div className="sp-replace-row">
        <input
          className="sp-input"
          placeholder="Reemplazar por…"
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        />
        <button
          className="sp-replace-btn"
          title="Reemplazar todo"
          disabled={!results.length}
          onClick={() => void replaceAll()}
        >
          ⇄
        </button>
      </div>

      {message && <div className="sp-message">{message}</div>}
      {searching && <div className="sp-message">Buscando…</div>}
      {!searching && query.trim() && (
        <div className="sp-count">
          {results.length
            ? `${results.length} resultado(s) en ${grouped.length} archivo(s)${results.length >= 500 ? " (máx.)" : ""}`
            : "Sin resultados"}
        </div>
      )}

      <div className="sp-results">
        {grouped.map(([file, matches]) => (
          <div key={file} className="sp-group">
            <div className="sp-file" title={file}>
              {file}
            </div>
            {matches.map((m, i) => (
              <div
                key={`${m.line}-${i}`}
                className="sp-match"
                onClick={() => onOpenAt(root + "\\" + m.file, m.line)}
              >
                <span className="sp-line">{m.line}</span>
                <span className="sp-text">{highlight(m.text)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
