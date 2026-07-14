import { useEffect, useRef, type ComponentProps } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import { getFileLanguage } from "../languages";

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
      // fondo SÓLIDO: con transparencia total, Chromium deja rastros del
      // frame anterior al hacer scroll (texto fantasma sobrepuesto)
      "editor.background": "#080c1c",
      "editor.foreground": "#c8dcff",
      "editor.lineHighlightBackground": "#0a84ff0e",
      "editor.selectionBackground": "#0a84ff38",
      "editorCursor.foreground": "#0a84ff",
      "editorLineNumber.foreground": "#1a3060",
      "editorLineNumber.activeForeground": "#0a84ff",
      "editor.wordHighlightBackground": "#0a84ff22",
      "editorBracketMatch.background": "#0a84ff22",
      "editorBracketMatch.border": "#0a84ff55",
      "scrollbar.shadow": "#00000000",
      "scrollbarSlider.background": "#0a84ff22",
      "scrollbarSlider.hoverBackground": "#0a84ff44",
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
  onChange: (value: string) => void;
  onSave: () => void;
  onCursorChange: (line: number, column: number) => void;
  onReady?: (editor: MonacoEditorInstance) => void;
}

export default function Editor({
  filePath,
  content,
  onChange,
  onSave,
  onCursorChange,
  onReady,
}: Props) {
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
        <span>Abre un archivo para empezar a editar</span>
      </div>
    );
  }

  return (
    <MonacoEditor
      height="100%"
      path={filePath}
      language={getFileLanguage(filePath).id}
      value={content}
      theme="levitico"
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
