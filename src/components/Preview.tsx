import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";

export function MarkdownView({ source }: { source: string }) {
  const html = useMemo(
    () => marked.parse(source, { async: false }) as string,
    [source],
  );
  return (
    <div className="md-preview-wrap">
      <div
        className="md-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function ImageView({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    void window.api.readFileBase64(path).then((data) => {
      if (alive) setSrc(data);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="img-preview">
      {src ? <img src={src} alt={path} /> : <span>Cargando…</span>}
    </div>
  );
}
