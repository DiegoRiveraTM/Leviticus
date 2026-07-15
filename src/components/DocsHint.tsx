import { useT, type Lang } from "../i18n";

// documentación oficial por lenguaje; la búsqueda usa devdocs.io, que
// cubre todos los lenguajes con un solo formato de URL
const DOC_HOMES: Record<string, { slug: string; home: (l: Lang) => string }> = {
  python: {
    slug: "python",
    home: (l) => `https://docs.python.org/${l === "es" ? "es/" : ""}3/`,
  },
  javascript: {
    slug: "javascript",
    home: (l) =>
      `https://developer.mozilla.org/${l === "es" ? "es" : "en-US"}/docs/Web/JavaScript`,
  },
  typescript: {
    slug: "typescript",
    home: () => "https://www.typescriptlang.org/docs/",
  },
  html: {
    slug: "html",
    home: (l) =>
      `https://developer.mozilla.org/${l === "es" ? "es" : "en-US"}/docs/Web/HTML`,
  },
  css: {
    slug: "css",
    home: (l) =>
      `https://developer.mozilla.org/${l === "es" ? "es" : "en-US"}/docs/Web/CSS`,
  },
  java: { slug: "openjdk", home: () => "https://docs.oracle.com/en/java/" },
  go: { slug: "go", home: () => "https://go.dev/doc/" },
  rust: { slug: "rust", home: () => "https://doc.rust-lang.org/book/" },
  c: { slug: "c", home: () => "https://en.cppreference.com/w/c" },
  cpp: { slug: "cpp", home: () => "https://en.cppreference.com/w/cpp" },
  csharp: {
    slug: "csharp",
    home: (l) =>
      `https://learn.microsoft.com/${l === "es" ? "es-mx" : "en-us"}/dotnet/csharp/`,
  },
  php: {
    slug: "php",
    home: (l) => `https://www.php.net/manual/${l === "es" ? "es" : "en"}/`,
  },
  ruby: { slug: "ruby", home: () => "https://ruby-doc.org/" },
  sql: { slug: "postgresql", home: () => "https://devdocs.io/" },
  markdown: { slug: "markdown", home: () => "https://www.markdownguide.org/" },
};

export interface DocsHintData {
  langId: string;
  langLabel: string;
  word: string;
}

interface Props {
  data: DocsHintData;
  onClose: () => void;
  onDisable: () => void;
}

export default function DocsHint({ data, onClose, onDisable }: Props) {
  const { lang, t } = useT();
  const doc = DOC_HOMES[data.langId];

  function open(url: string) {
    void window.api.openExternal(url);
    onClose();
  }

  return (
    <div className="docs-hint">
      <div className="dh-head">
        <span className="dh-title">{t("docs.title", data.langLabel)}</span>
        <button className="dh-close" title={t("tip.close")} onClick={onClose}>
          <svg width="9" height="9" viewBox="0 0 10 10">
            <path
              d="M1.5 1.5l7 7M8.5 1.5l-7 7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="dh-body">{t("docs.body")}</div>
      <div className="dh-actions">
        {data.word && (
          <button
            className="dh-btn primary"
            onClick={() =>
              open(
                `https://devdocs.io/#q=${encodeURIComponent(
                  `${doc?.slug ?? data.langId} ${data.word}`,
                )}`,
              )
            }
          >
            {t("docs.search", data.word)}
          </button>
        )}
        {doc && (
          <button className="dh-btn" onClick={() => open(doc.home(lang))}>
            {t("docs.open", data.langLabel)}
          </button>
        )}
      </div>
      <button className="dh-dismiss" onClick={onDisable}>
        {t("docs.dismiss")}
      </button>
    </div>
  );
}
