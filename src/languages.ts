export interface LangInfo {
  /** id de lenguaje de Monaco para el resaltado */
  id: string;
  /** nombre de la tecnología que se muestra en la interfaz */
  label: string;
}

// extensión → lenguaje de Monaco + nombre de la tecnología.
// Cuando Monaco no tiene gramática propia se usa la más parecida
// (p. ej. Astro/Vue/Svelte → html) pero la etiqueta dice la tecnología real.
const EXTENSIONS: Record<string, { l: string; n?: string }> = {
  // JavaScript / TypeScript
  ts: { l: "typescript", n: "TypeScript" },
  mts: { l: "typescript", n: "TypeScript" },
  cts: { l: "typescript", n: "TypeScript" },
  tsx: { l: "typescript", n: "TypeScript (React)" },
  js: { l: "javascript", n: "JavaScript" },
  mjs: { l: "javascript", n: "JavaScript" },
  cjs: { l: "javascript", n: "JavaScript" },
  jsx: { l: "javascript", n: "JavaScript (React)" },
  // Web / frameworks
  html: { l: "html", n: "HTML" },
  htm: { l: "html", n: "HTML" },
  astro: { l: "html", n: "Astro" },
  vue: { l: "html", n: "Vue" },
  svelte: { l: "html", n: "Svelte" },
  ejs: { l: "html", n: "EJS" },
  erb: { l: "html", n: "ERB (Rails)" },
  hbs: { l: "handlebars", n: "Handlebars" },
  pug: { l: "pug", n: "Pug" },
  twig: { l: "twig", n: "Twig" },
  njk: { l: "twig", n: "Nunjucks" },
  liquid: { l: "liquid", n: "Liquid" },
  cshtml: { l: "razor", n: "Razor" },
  razor: { l: "razor", n: "Razor" },
  css: { l: "css", n: "CSS" },
  scss: { l: "scss", n: "SCSS" },
  sass: { l: "scss", n: "Sass" },
  less: { l: "less", n: "Less" },
  styl: { l: "css", n: "Stylus" },
  // Datos / configuración
  json: { l: "json", n: "JSON" },
  jsonc: { l: "json", n: "JSON" },
  json5: { l: "json", n: "JSON5" },
  ipynb: { l: "json", n: "Jupyter Notebook" },
  xml: { l: "xml", n: "XML" },
  svg: { l: "xml", n: "SVG" },
  xaml: { l: "xml", n: "XAML" },
  plist: { l: "xml", n: "Plist" },
  yml: { l: "yaml", n: "YAML" },
  yaml: { l: "yaml", n: "YAML" },
  toml: { l: "ini", n: "TOML" },
  ini: { l: "ini", n: "INI" },
  cfg: { l: "ini", n: "Config" },
  conf: { l: "ini", n: "Config" },
  env: { l: "ini", n: "dotenv" },
  properties: { l: "ini", n: "Properties" },
  md: { l: "markdown", n: "Markdown" },
  mdx: { l: "markdown", n: "MDX" },
  rst: { l: "restructuredtext", n: "reStructuredText" },
  tex: { l: "plaintext", n: "LaTeX" },
  csv: { l: "plaintext", n: "CSV" },
  graphql: { l: "graphql", n: "GraphQL" },
  gql: { l: "graphql", n: "GraphQL" },
  prisma: { l: "graphql", n: "Prisma" },
  proto: { l: "protobuf", n: "Protocol Buffers" },
  // Lenguajes de sistemas
  c: { l: "c", n: "C" },
  h: { l: "c", n: "C (header)" },
  cpp: { l: "cpp", n: "C++" },
  cc: { l: "cpp", n: "C++" },
  cxx: { l: "cpp", n: "C++" },
  hpp: { l: "cpp", n: "C++ (header)" },
  hh: { l: "cpp", n: "C++ (header)" },
  rs: { l: "rust", n: "Rust" },
  go: { l: "go", n: "Go" },
  zig: { l: "plaintext", n: "Zig" },
  nim: { l: "plaintext", n: "Nim" },
  asm: { l: "mips", n: "Ensamblador" },
  s: { l: "mips", n: "Ensamblador" },
  wat: { l: "plaintext", n: "WebAssembly" },
  // JVM / .NET
  java: { l: "java", n: "Java" },
  kt: { l: "kotlin", n: "Kotlin" },
  kts: { l: "kotlin", n: "Kotlin" },
  scala: { l: "scala", n: "Scala" },
  groovy: { l: "java", n: "Groovy" },
  gradle: { l: "java", n: "Gradle" },
  cs: { l: "csharp", n: "C#" },
  csx: { l: "csharp", n: "C#" },
  fs: { l: "fsharp", n: "F#" },
  fsx: { l: "fsharp", n: "F#" },
  vb: { l: "vb", n: "Visual Basic" },
  // Scripting / backend
  py: { l: "python", n: "Python" },
  pyw: { l: "python", n: "Python" },
  php: { l: "php", n: "PHP" },
  rb: { l: "ruby", n: "Ruby" },
  pl: { l: "perl", n: "Perl" },
  pm: { l: "perl", n: "Perl" },
  lua: { l: "lua", n: "Lua" },
  r: { l: "r", n: "R" },
  jl: { l: "julia", n: "Julia" },
  dart: { l: "dart", n: "Dart" },
  swift: { l: "swift", n: "Swift" },
  m: { l: "objective-c", n: "Objective-C" },
  mm: { l: "objective-c", n: "Objective-C++" },
  ex: { l: "elixir", n: "Elixir" },
  exs: { l: "elixir", n: "Elixir" },
  erl: { l: "plaintext", n: "Erlang" },
  clj: { l: "clojure", n: "Clojure" },
  cljs: { l: "clojure", n: "ClojureScript" },
  edn: { l: "clojure", n: "Clojure (EDN)" },
  hs: { l: "plaintext", n: "Haskell" },
  elm: { l: "plaintext", n: "Elm" },
  coffee: { l: "coffee", n: "CoffeeScript" },
  scm: { l: "scheme", n: "Scheme" },
  tcl: { l: "tcl", n: "Tcl" },
  sol: { l: "solidity", n: "Solidity" },
  pas: { l: "pascal", n: "Pascal" },
  // Shells
  sh: { l: "shell", n: "Shell" },
  bash: { l: "shell", n: "Bash" },
  zsh: { l: "shell", n: "Zsh" },
  fish: { l: "shell", n: "Fish" },
  ps1: { l: "powershell", n: "PowerShell" },
  psm1: { l: "powershell", n: "PowerShell" },
  psd1: { l: "powershell", n: "PowerShell" },
  bat: { l: "bat", n: "Batch" },
  cmd: { l: "bat", n: "Batch" },
  // Bases de datos
  sql: { l: "sql", n: "SQL" },
  mysql: { l: "mysql", n: "MySQL" },
  pgsql: { l: "pgsql", n: "PostgreSQL" },
  sqlite: { l: "sql", n: "SQLite" },
  // Infraestructura
  dockerfile: { l: "dockerfile", n: "Dockerfile" },
  tf: { l: "hcl", n: "Terraform" },
  tfvars: { l: "hcl", n: "Terraform" },
  hcl: { l: "hcl", n: "HCL" },
  nix: { l: "plaintext", n: "Nix" },
  cmake: { l: "plaintext", n: "CMake" },
  mk: { l: "plaintext", n: "Makefile" },
  lock: { l: "plaintext", n: "Lockfile" },
  log: { l: "plaintext", n: "Log" },
  txt: { l: "plaintext", n: "Texto plano" },
};

// archivos que se reconocen por nombre completo, sin extensión
const FILENAMES: Record<string, { l: string; n: string }> = {
  dockerfile: { l: "dockerfile", n: "Dockerfile" },
  makefile: { l: "plaintext", n: "Makefile" },
  "cmakelists.txt": { l: "plaintext", n: "CMake" },
  ".gitignore": { l: "ini", n: "Git ignore" },
  ".gitattributes": { l: "ini", n: "Git attributes" },
  ".editorconfig": { l: "ini", n: "EditorConfig" },
  ".npmrc": { l: "ini", n: "npm config" },
  ".prettierrc": { l: "json", n: "Prettier" },
  ".eslintrc": { l: "json", n: "ESLint" },
  ".babelrc": { l: "json", n: "Babel" },
  license: { l: "plaintext", n: "Licencia" },
  readme: { l: "markdown", n: "Markdown" },
};

export function getFileLanguage(filePath: string): LangInfo {
  const name = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const byName = FILENAMES[name];
  if (byName) return { id: byName.l, label: byName.n };
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  const byExt = EXTENSIONS[ext];
  if (byExt) return { id: byExt.l, label: byExt.n ?? byExt.l };
  return { id: "plaintext", label: ext ? ext.toUpperCase() : "Texto plano" };
}
