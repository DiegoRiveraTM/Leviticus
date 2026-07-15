import { useEffect, useRef } from "react";

interface Props {
  active: boolean;
}

// color del acento del tema activo como [r, g, b]
function accentRgb(): [number, number, number] {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent")
    .trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(v);
  if (!m) return [80, 140, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function RacingBorder({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const posRef = useRef(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight;
    const ctx = canvas.getContext("2d")!;

    // sigue al tema activo; se recolorea al vuelo con el evento lv-theme
    let [r, g, b] = accentRgb();
    const onTheme = () => {
      [r, g, b] = accentRgb();
    };
    window.addEventListener("lv-theme", onTheme);

    function pointOnRect(p: number, w: number, h: number) {
      const perim = 2 * (w + h);
      p = ((p % perim) + perim) % perim;
      if (p < w) return { x: p, y: 0 };
      if (p < w + h) return { x: w, y: p - w };
      if (p < 2 * w + h) return { x: w - (p - w - h), y: h };
      return { x: 0, y: h - (p - 2 * w - h) };
    }

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const perim = 2 * (w + h);
      ctx.clearRect(0, 0, w, h);

      const tailLen = 40;
      const steps = 30;

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const p = (posRef.current - t * tailLen + perim * 10) % perim;
        const pt = pointOnRect(p, w, h);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (1 - t) * 2 + 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${(1 - t) * 0.7})`;
        ctx.fill();
      }

      const head = pointOnRect(posRef.current, w, h);
      const grd = ctx.createRadialGradient(
        head.x,
        head.y,
        0,
        head.x,
        head.y,
        6,
      );
      grd.addColorStop(0, "rgba(255,255,255,0.95)");
      grd.addColorStop(0.4, `rgba(${r},${g},${b},0.85)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      posRef.current = (posRef.current + 1.4) % perim;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("lv-theme", onTheme);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        borderRadius: 4,
      }}
    />
  );
}
