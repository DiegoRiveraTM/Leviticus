import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

export interface TerminalHandle {
  runCommand: (command: string) => void;
  isBusy: () => boolean;
}

interface Props {
  sessionId: number;
  cwd: string | null;
}

function normalize(data: string): string {
  return data.replace(/\r?\n/g, "\r\n");
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

// color del prompt según el tema activo, como secuencia truecolor "r;g;b"
function promptColor(): string {
  return cssVar("--term-prompt", "138 194 255").split(/[\s,]+/).join(";");
}

const Terminal = forwardRef<TerminalHandle, Props>(function Terminal(
  { sessionId, cwd },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const bufferRef = useRef("");
  // posición del cursor dentro del buffer: permite corregir con las
  // flechas sin tener que borrar toda la línea
  const cursorRef = useRef(0);
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef(-1);
  const runningRef = useRef(false);
  const cwdRef = useRef("");
  const hadProjectRef = useRef(false);
  // valor actual de la prop cwd, para que el montaje (async) lea el más nuevo
  const cwdPropRef = useRef(cwd);
  cwdPropRef.current = cwd;
  // ¿ya se imprimió el primer prompt? / ¿hay salida de comandos en pantalla?
  const promptDrawnRef = useRef(false);
  const hasContentRef = useRef(false);
  // comando recibido antes de que la terminal terminara de crearse
  // (fuentes, cwd): se ejecuta en cuanto esté lista en vez de perderse
  const queuedRef = useRef<string | null>(null);

  function shortCwd() {
    const parts = cwdRef.current.split(/[\\/]/).filter(Boolean);
    return parts.length > 2 ? "…\\" + parts.slice(-2).join("\\") : cwdRef.current;
  }

  function prompt() {
    promptDrawnRef.current = true;
    const c = promptColor();
    termRef.current?.write(
      `\x1b[1;38;2;${c}m${shortCwd()}\x1b[0m \x1b[1;38;2;${c}m❯\x1b[0m `,
    );
  }

  function redrawLine() {
    termRef.current?.write("\r\x1b[K");
    prompt();
    termRef.current?.write(bufferRef.current);
    cursorRef.current = bufferRef.current.length;
  }

  async function submit(cmd: string) {
    const term = termRef.current!;
    if (!cmd.trim()) {
      prompt();
      return;
    }
    historyRef.current.push(cmd);
    histIdxRef.current = historyRef.current.length;
    hasContentRef.current = true;

    if (cmd.trim() === "clear" || cmd.trim() === "cls") {
      term.clear();
      prompt();
      return;
    }

    runningRef.current = true;
    const res = await window.api.termRun(sessionId, cmd);
    cwdRef.current = res.cwd;
    if (res.output) term.write(normalize(res.output));
    if (res.done) {
      runningRef.current = false;
      prompt();
    }
  }

  useImperativeHandle(ref, () => ({
    runCommand(command: string) {
      const term = termRef.current;
      if (runningRef.current) return; // App busca una terminal libre antes
      if (!term) {
        queuedRef.current = command;
        return;
      }
      // descarta lo que hubiera escrito el usuario y ejecuta
      bufferRef.current = "";
      cursorRef.current = 0;
      term.write("\r\x1b[K");
      prompt();
      term.write(command + "\r\n");
      void submit(command);
    },
    isBusy: () => runningRef.current,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const cleanups: (() => void)[] = [];

    void (async () => {
      // xterm mide el ancho de celda al crearse: si la fuente aún no cargó,
      // mide con la fuente de reserva y las letras quedan mal espaciadas
      try {
        await document.fonts.load("600 13px 'JetBrains Mono'");
        await document.fonts.load("800 13px 'JetBrains Mono'");
        await document.fonts.ready;
      } catch {
        /* seguimos con la fuente de reserva */
      }
      if (disposed) return;

      const term = new XTerm({
        allowTransparency: true,
        cursorBlink: true,
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13,
        fontWeight: "600",
        fontWeightBold: "800",
        letterSpacing: 0,
        lineHeight: 1.3,
        scrollback: 3000,
        theme: {
          background: "#00000000",
          foreground: "#c8dcff",
          cursor: cssVar("--accent", "#0a84ff"),
          cursorAccent: "#02040a",
          selectionBackground: "#0a84ff44",
          black: "#0a0f1e",
          blue: "#1a56ff",
          brightBlue: "#6ab0ff",
          cyan: "#4a9eff",
          brightCyan: "#8ac4ff",
          white: "#c8dcff",
          brightWhite: "#ffffff",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(container);
      fit.fit();
      termRef.current = term;
      cleanups.push(() => {
        term.dispose();
        termRef.current = null;
      });

      const resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
          // si el primer prompt se imprimió cuando el layout aún no tenía
          // su tamaño real, quedó envuelto en varias líneas; mientras no
          // haya salida de comandos es seguro redibujarlo limpio
          if (
            promptDrawnRef.current &&
            !hasContentRef.current &&
            !runningRef.current
          ) {
            term.reset();
            prompt();
            term.write(bufferRef.current);
          }
        } catch {
          /* contenedor oculto */
        }
      });
      resizeObserver.observe(container);
      cleanups.push(() => resizeObserver.disconnect());

      cleanups.push(
        window.api.onTermData((id, data) => {
          if (id === sessionId) {
            hasContentRef.current = true;
            term.write(normalize(data));
          }
        }),
      );
      cleanups.push(
        window.api.onTermExit((id, code, newCwd) => {
          if (id !== sessionId) return;
          runningRef.current = false;
          cwdRef.current = newCwd;
          if (code !== 0)
            term.write(`\x1b[38;5;203m✕ código de salida ${code}\x1b[0m\r\n`);
          prompt();
        }),
      );

      const dataDisposable = term.onData((data) => {
        if (runningRef.current) {
          // proceso activo: Ctrl+C lo mata, el resto va a stdin con eco local
          if (data === "\x03") {
            void window.api.termKill(sessionId);
            return;
          }
          const out = data === "\r" ? "\r\n" : data;
          term.write(out);
          void window.api.termStdin(sessionId, out);
          return;
        }

        switch (data) {
          case "\r":
            term.write("\r\n");
            {
              const cmd = bufferRef.current;
              bufferRef.current = "";
              cursorRef.current = 0;
              void submit(cmd);
            }
            return;
          case "\x7f": { // backspace: borra el carácter a la izquierda del cursor
            const cur = cursorRef.current;
            if (cur > 0) {
              const tail = bufferRef.current.slice(cur);
              bufferRef.current = bufferRef.current.slice(0, cur - 1) + tail;
              cursorRef.current = cur - 1;
              term.write("\b" + tail + " " + `\x1b[${tail.length + 1}D`);
            }
            return;
          }
          case "\x1b[3~": { // Supr: borra el carácter bajo el cursor
            const cur = cursorRef.current;
            if (cur < bufferRef.current.length) {
              const tail = bufferRef.current.slice(cur + 1);
              bufferRef.current = bufferRef.current.slice(0, cur) + tail;
              term.write(tail + " " + `\x1b[${tail.length + 1}D`);
            }
            return;
          }
          case "\x1b[D": // flecha izquierda
            if (cursorRef.current > 0) {
              cursorRef.current--;
              term.write("\x1b[D");
            }
            return;
          case "\x1b[C": // flecha derecha
            if (cursorRef.current < bufferRef.current.length) {
              cursorRef.current++;
              term.write("\x1b[C");
            }
            return;
          case "\x1b[H": // Inicio
          case "\x1b[1~":
            if (cursorRef.current > 0) {
              term.write(`\x1b[${cursorRef.current}D`);
              cursorRef.current = 0;
            }
            return;
          case "\x1b[F": // Fin
          case "\x1b[4~": {
            const jump = bufferRef.current.length - cursorRef.current;
            if (jump > 0) {
              term.write(`\x1b[${jump}C`);
              cursorRef.current = bufferRef.current.length;
            }
            return;
          }
          case "\x03": // Ctrl+C
            term.write("^C\r\n");
            bufferRef.current = "";
            cursorRef.current = 0;
            prompt();
            return;
          case "\x0c": // Ctrl+L
            term.clear();
            bufferRef.current = "";
            redrawLine();
            return;
          case "\x1b[A": { // flecha arriba: historial
            if (histIdxRef.current > 0) {
              histIdxRef.current--;
              bufferRef.current = historyRef.current[histIdxRef.current] ?? "";
              redrawLine();
            }
            return;
          }
          case "\x1b[B": { // flecha abajo
            if (histIdxRef.current < historyRef.current.length) {
              histIdxRef.current++;
              bufferRef.current = historyRef.current[histIdxRef.current] ?? "";
              redrawLine();
            }
            return;
          }
          default:
            if (data.startsWith("\x1b")) return; // otras secuencias de escape
            {
              // texto imprimible (incluye pegado); nos quedamos con la primera
              // línea y se inserta en la posición del cursor
              // eslint-disable-next-line no-control-regex
              const clean = data.split(/\r?\n/)[0].replace(/[\x00-\x1f]/g, "");
              if (clean) {
                const cur = cursorRef.current;
                const tail = bufferRef.current.slice(cur);
                bufferRef.current =
                  bufferRef.current.slice(0, cur) + clean + tail;
                cursorRef.current = cur + clean.length;
                term.write(clean + tail);
                if (tail.length) term.write(`\x1b[${tail.length}D`);
              }
            }
        }
      });
      cleanups.push(() => dataDisposable.dispose());

      // al cambiar el tema se actualiza el cursor (App dispara "lv-theme")
      const onTheme = () => {
        term.options.theme = {
          ...term.options.theme,
          cursor: cssVar("--accent", "#0a84ff"),
          selectionBackground: cssVar("--selection", "#0a84ff44"),
        };
      };
      window.addEventListener("lv-theme", onTheme);
      cleanups.push(() => window.removeEventListener("lv-theme", onTheme));

      // fija el cwd inicial y recién entonces imprime el primer prompt:
      // hacerlo en dos efectos separados corría getCwd y setCwd en paralelo
      // y las escrituras intercaladas dejaban el prompt cortado
      if (cwdPropRef.current) hadProjectRef.current = true;
      cwdRef.current = await window.api.termSetCwd(
        sessionId,
        cwdPropRef.current ?? "~",
      );
      if (disposed) return;
      // re-medir: entre open() y este punto el layout pudo asentarse y el
      // fit inicial haber corrido con el contenedor a medio acomodar
      try {
        fit.fit();
      } catch {
        /* contenedor oculto */
      }
      prompt();
      if (queuedRef.current) {
        const cmd = queuedRef.current;
        queuedRef.current = null;
        term.write(cmd + "\r\n");
        void submit(cmd);
      }
    })();

    return () => {
      disposed = true;
      cleanups.reverse().forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // al abrir un proyecto la terminal se mueve a esa carpeta;
  // al cerrarlo regresa a la carpeta de inicio
  useEffect(() => {
    if (cwd) hadProjectRef.current = true;
    else if (!hadProjectRef.current) return;
    // terminal aún inicializándose: el montaje leerá cwdPropRef al final
    if (!termRef.current) return;

    void (async () => {
      cwdRef.current = await window.api.termSetCwd(sessionId, cwd ?? "~");
      if (!runningRef.current && termRef.current) {
        bufferRef.current = "";
        redrawLine();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  return <div className="xterm-container" ref={containerRef} />;
});

export default Terminal;
