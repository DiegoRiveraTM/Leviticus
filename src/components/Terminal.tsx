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
}

interface Props {
  cwd: string | null;
}

function normalize(data: string): string {
  return data.replace(/\r?\n/g, "\r\n");
}

const Terminal = forwardRef<TerminalHandle, Props>(function Terminal(
  { cwd },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const bufferRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef(-1);
  const runningRef = useRef(false);
  const cwdRef = useRef("");
  const hadProjectRef = useRef(false);

  function shortCwd() {
    const parts = cwdRef.current.split(/[\\/]/).filter(Boolean);
    return parts.length > 2 ? "…\\" + parts.slice(-2).join("\\") : cwdRef.current;
  }

  function prompt() {
    termRef.current?.write(
      `\x1b[1;38;5;111m${shortCwd()}\x1b[0m \x1b[1;38;5;69m❯\x1b[0m `,
    );
  }

  function redrawLine() {
    termRef.current?.write("\r\x1b[K");
    prompt();
    termRef.current?.write(bufferRef.current);
  }

  async function submit(cmd: string) {
    const term = termRef.current!;
    if (!cmd.trim()) {
      prompt();
      return;
    }
    historyRef.current.push(cmd);
    histIdxRef.current = historyRef.current.length;

    if (cmd.trim() === "clear" || cmd.trim() === "cls") {
      term.clear();
      prompt();
      return;
    }

    runningRef.current = true;
    const res = await window.api.termRun(cmd);
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
      if (!term || runningRef.current) return;
      // descarta lo que hubiera escrito el usuario y ejecuta
      bufferRef.current = "";
      term.write("\r\x1b[K");
      prompt();
      term.write(command + "\r\n");
      void submit(command);
    },
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
          cursor: "#0a84ff",
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
        } catch {
          /* contenedor oculto */
        }
      });
      resizeObserver.observe(container);
      cleanups.push(() => resizeObserver.disconnect());

      cleanups.push(
        window.api.onTermData((data) => term.write(normalize(data))),
      );
      cleanups.push(
        window.api.onTermExit((code, newCwd) => {
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
            void window.api.termKill();
            return;
          }
          const out = data === "\r" ? "\r\n" : data;
          term.write(out);
          void window.api.termStdin(out);
          return;
        }

        switch (data) {
          case "\r":
            term.write("\r\n");
            {
              const cmd = bufferRef.current;
              bufferRef.current = "";
              void submit(cmd);
            }
            return;
          case "\x7f": // backspace
            if (bufferRef.current.length > 0) {
              bufferRef.current = bufferRef.current.slice(0, -1);
              term.write("\b \b");
            }
            return;
          case "\x03": // Ctrl+C
            term.write("^C\r\n");
            bufferRef.current = "";
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
              // texto imprimible (incluye pegado); nos quedamos con la primera línea
              // eslint-disable-next-line no-control-regex
              const clean = data.split(/\r?\n/)[0].replace(/[\x00-\x1f]/g, "");
              if (clean) {
                bufferRef.current += clean;
                term.write(clean);
              }
            }
        }
      });
      cleanups.push(() => dataDisposable.dispose());

      cwdRef.current = await window.api.termGetCwd();
      if (disposed) return;
      prompt();
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

    void (async () => {
      cwdRef.current = await window.api.termSetCwd(cwd ?? "~");
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
