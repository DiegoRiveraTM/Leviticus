# Levitico

> **Note**: This project was created for **personal use** and its code was **generated 100% with AI**. It doesn't aim to compete with any professional editor.

![Levitico](public/Intro.png)

## Features

- **Space-themed glassmorphism UI** — floating glass panels over an animated starfield, Inter + JetBrains Mono typography, frameless window with custom controls.
- **Monaco editor** (the engine behind VS Code) with a custom theme and syntax highlighting for **~95 languages and technologies** (TypeScript, Python, Java, Rust, Astro, Vue, Svelte, Terraform, Solidity…), with validation squiggles disabled: colors only.
- **Multiple tabs**, VS Code style: files stack up, with an unsaved-changes indicator and `Ctrl+W` to close.
- **Integrated terminal** (xterm + PowerShell) with folder navigation (`cd`), arrow-key history, `Ctrl+C`, and interactive stdin.
- **One-click execution**:
  - ▶ runs the current file based on its language (Python, Node, Java, Go, Rust, C/C++, C#, PHP, Ruby…).
  - ⏩ runs the whole project: detects `package.json`, runs `npm install` if `node_modules` is missing, then launches `npm run dev`.
  - If a tool is missing (Python, Node, JDK…), a modal takes you to the **official download link**.
- **Automatic preview**: when the dev server prints its URL (`http://localhost:...`), it opens in your browser automatically.
- **Built-in Git**: initialize a repository, commit, and **push to GitHub** from the UI; the explorer colors files like VS Code (green = new, orange = modified, red = deleted).
- **Resizable panels** (explorer, editor, terminal) with sizes persisted across sessions.
- **Live status bar**: detected language, cursor position, app RAM usage, battery, clock, and session time.

## Development

```bash
npm install
npm run dev
```

## Building the installer (.exe)

```bash
npm run build
```

Output lands in `release/<version>/`:

- `Levitico-Windows-<version>-Setup.exe` — installer
- `win-unpacked/Levitico.exe` — portable version

## Stack

| Layer | Technology |
|---|---|
| Desktop | Electron 30 |
| UI | React 18 + TypeScript + Vite |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Terminal | @xterm/xterm + PowerShell (no node-pty: the cwd lives in the main process) |
| Packaging | electron-builder (NSIS) |

## Structure

```
my-ide/
├── electron/          # main process: window, fs, terminal, git, metrics
│   ├── main.ts
│   └── preload.ts     # secure bridge (contextBridge) to the renderer
├── src/
│   ├── App.tsx        # layout, tabs, execution, git panel
│   ├── languages.ts   # detection of ~95 languages/technologies
│   ├── SpaceBg.ts     # animated starfield background (30 fps)
│   └── components/
│       ├── Editor.tsx        # Monaco + levitico theme
│       ├── Terminal.tsx      # interactive xterm terminal
│       ├── FileTree.tsx      # explorer with git status
│       └── StatusExtras.tsx  # RAM, battery, clock, session
└── electron-builder.json5
```

## License

[MIT](LICENSE) — free to use, copy, and modify. Provided "as is", without warranty of any kind.

> **Heads up when installing**: the installer is not code-signed, so Windows SmartScreen will show an "unknown publisher" warning. Click "More info" → "Run anyway". This is normal for independent open-source projects.

---

*Made with 🤖 — every line of this project (including this README) was written by AI.*
