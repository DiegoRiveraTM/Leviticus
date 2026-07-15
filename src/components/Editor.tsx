import { useEffect, useRef, type ComponentProps } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import { getFileLanguage } from "../languages";
import { useT } from "../i18n";

// fondo transparente en los tres temas: el tinte lo pone el vidrio de
// .editor-area, cuya opacidad ajusta el usuario; ese panel siempre pinta
// un fondo, lo que evita el texto fantasma que dejaba Chromium al hacer
// scroll cuando toda la cadena hasta el canvas era transparente
const SHARED_COLORS = {
  "editor.background": "#00000000",
  "scrollbar.shadow": "#00000000",
};

loader.init().then((m) => {
  m.editor.defineTheme("levitico", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "2a3a6a", fontStyle: "italic" },
      { token: "keyword", foreground: "1a56ff", fontStyle: "bold" },
      { token: "string", foreground: "4a9eff" },
      { token: "number", foreground: "6ab0ff" },
      { token: "type", foreground: "3a7fff" },
      { token: "function", foreground: "a0c4ff" },
      { token: "variable", foreground: "c8dcff" },
      { token: "tag", foreground: "3a7fff" },
      { token: "attribute.name", foreground: "6ab0ff" },
      { token: "attribute.value", foreground: "4a9eff" },
      { token: "delimiter", foreground: "5a7ab0" },
    ],
    colors: {
      ...SHARED_COLORS,
      "editor.foreground": "#c8dcff",
      "editor.lineHighlightBackground": "#0a84ff0e",
      "editor.selectionBackground": "#0a84ff38",
      "editorCursor.foreground": "#0a84ff",
      "editorLineNumber.foreground": "#1a3060",
      "editorLineNumber.activeForeground": "#0a84ff",
      "editor.wordHighlightBackground": "#0a84ff22",
      "editorBracketMatch.background": "#0a84ff22",
      "editorBracketMatch.border": "#0a84ff55",
      "scrollbarSlider.background": "#0a84ff22",
      "scrollbarSlider.hoverBackground": "#0a84ff44",
    },
  });

  m.editor.defineTheme("levitico-negro", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "494f5c", fontStyle: "italic" },
      { token: "keyword", foreground: "f2f4f8", fontStyle: "bold" },
      { token: "string", foreground: "aab2c0" },
      { token: "number", foreground: "ccd2dc" },
      { token: "type", foreground: "dde2ea" },
      { token: "function", foreground: "ffffff" },
      { token: "variable", foreground: "c4cad4" },
      { token: "tag", foreground: "e8ebf0" },
      { token: "attribute.name", foreground: "b8c0cc" },
      { token: "attribute.value", foreground: "9aa2b0" },
      { token: "delimiter", foreground: "6a7180" },
    ],
    colors: {
      ...SHARED_COLORS,
      "editor.foreground": "#ccd2dc",
      "editor.lineHighlightBackground": "#ffffff0a",
      "editor.selectionBackground": "#ffffff2e",
      "editorCursor.foreground": "#ffffff",
      "editorLineNumber.foreground": "#3a3f4a",
      "editorLineNumber.activeForeground": "#d6dae2",
      "editor.wordHighlightBackground": "#ffffff1a",
      "editorBracketMatch.background": "#ffffff1a",
      "editorBracketMatch.border": "#ffffff44",
      "scrollbarSlider.background": "#ffffff1e",
      "scrollbarSlider.hoverBackground": "#ffffff38",
    },
  });

  m.editor.defineTheme("levitico-rojo", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6a2a32", fontStyle: "italic" },
      { token: "keyword", foreground: "ff4d5e", fontStyle: "bold" },
      { token: "string", foreground: "ff9d8a" },
      { token: "number", foreground: "ffb3a0" },
      { token: "type", foreground: "f2647a" },
      { token: "function", foreground: "ffc2c8" },
      { token: "variable", foreground: "ffd8da" },
      { token: "tag", foreground: "f2647a" },
      { token: "attribute.name", foreground: "ffb3a0" },
      { token: "attribute.value", foreground: "ff9d8a" },
      { token: "delimiter", foreground: "b06a72" },
    ],
    colors: {
      ...SHARED_COLORS,
      "editor.foreground": "#ffd8da",
      "editor.lineHighlightBackground": "#d926380e",
      "editor.selectionBackground": "#d9263838",
      "editorCursor.foreground": "#ff4d5e",
      "editorLineNumber.foreground": "#5a2028",
      "editorLineNumber.activeForeground": "#ff8f9a",
      "editor.wordHighlightBackground": "#d9263822",
      "editorBracketMatch.background": "#d9263822",
      "editorBracketMatch.border": "#d9263855",
      "scrollbarSlider.background": "#d9263822",
      "scrollbarSlider.hoverBackground": "#d9263844",
    },
  });

  // solo resaltado por lenguaje: sin subrayados de validación de
  // sintaxis, tipos ni sugerencias
  const diagOff = {
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  };
  m.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagOff);
  m.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagOff);
  m.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: false });
  m.languages.css.cssDefaults.setOptions({ validate: false });
  m.languages.css.scssDefaults.setOptions({ validate: false });
  m.languages.css.lessDefaults.setOptions({ validate: false });

  // Monaco mide el ancho de los glifos al crear el editor; si la fuente
  // aún no había cargado, el texto queda encimado. Re-medimos al terminar.
  void (async () => {
    try {
      await document.fonts.load("600 13.5px 'JetBrains Mono'");
      await document.fonts.ready;
    } catch {
      /* seguimos con la fuente de reserva */
    }
    m.editor.remeasureFonts();
  })();
});

export type MonacoEditorInstance = Parameters<
  NonNullable<ComponentProps<typeof MonacoEditor>["onMount"]>
>[0];

interface Props {
  filePath: string | null;
  content: string | null;
  themeName?: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorChange: (line: number, column: number) => void;
  onReady?: (editor: MonacoEditorInstance) => void;
}

export default function Editor({
  filePath,
  content,
  themeName = "levitico",
  onChange,
  onSave,
  onCursorChange,
  onReady,
}: Props) {
  const { t } = useT();
  // refs para que los comandos registrados en onMount siempre vean la versión actual
  const onSaveRef = useRef(onSave);
  const onCursorRef = useRef(onCursorChange);
  useEffect(() => {
    onSaveRef.current = onSave;
    onCursorRef.current = onCursorChange;
  });

  if (!filePath || content === null) {
    return (
      <div className="editor-empty">
        <span>{t("editor.empty")}</span>
      </div>
    );
  }

  return (
    <MonacoEditor
      height="100%"
      path={filePath}
      language={getFileLanguage(filePath).id}
      value={content}
      theme={themeName}
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSaveRef.current();
        });
        editor.onDidChangeCursorPosition((e) => {
          onCursorRef.current(e.position.lineNumber, e.position.column);
        });
        onReady?.(editor);
      }}
      options={{
        fontSize: 13.5,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: "600",
        fontLigatures: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        lineNumbers: "on",
        tabSize: 2,
        wordWrap: "off",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        padding: { top: 16 },
        scrollbar: {
          verticalScrollbarSize: 9,
          horizontalScrollbarSize: 9,
          useShadows: false,
        },
      }}
    />
  );
}
