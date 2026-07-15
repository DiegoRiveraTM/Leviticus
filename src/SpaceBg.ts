export function initSpaceBg() {
  const canvas = document.getElementById('space-bg') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  // el fondo tiene que notarse a través del vidrio: con estrellas diminutas
  // y nebulosas casi invisibles, bajar la opacidad de los paneles solo se
  // percibía como un cambio de tono, no como transparencia
  const STAR_COUNT = 260
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.7 + 0.3,
    alpha: Math.random() * 0.7 + 0.2,
    speed: Math.random() * 0.015 + 0.005,
    phase: Math.random() * Math.PI * 2,
    drift: Math.random() * 0.05 + 0.01,
  }))

  // posiciones relativas para que sobrevivan al resize
  const nebulas = [
    { x: 0.15, y: 0.3, r: 420, pulse: 0.006 },
    { x: 0.8, y: 0.6, r: 340, pulse: 0.008 },
    { x: 0.5, y: 0.85, r: 300, pulse: 0.005 },
    { x: 0.38, y: 0.05, r: 280, pulse: 0.007 },
  ]

  // los colores vienen del tema activo (variables CSS que App.tsx cambia
  // con data-theme); se releen solo cuando cambia el atributo
  let starColor = '180, 210, 255'
  let nebColors = ['26,86,255', '10,40,180', '40,60,200', '20,70,230']

  function readThemeColors() {
    const cs = getComputedStyle(document.documentElement)
    const get = (name: string, fallback: string) =>
      cs.getPropertyValue(name).trim() || fallback
    starColor = get('--star-rgb', starColor)
    nebColors = [
      get('--neb-1', nebColors[0]),
      get('--neb-2', nebColors[1]),
      get('--neb-3', nebColors[2]),
      get('--neb-4', nebColors[3]),
    ]
  }
  readThemeColors()
  new MutationObserver(readThemeColors).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  let t = 0
  let last = 0

  // limitado a ~30fps y pausado con la ventana oculta: cada repintado
  // obliga a recalcular el blur de los paneles de vidrio encima
  function draw(now: number) {
    requestAnimationFrame(draw)
    if (now - last < 33 || document.hidden) return
    last = now

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    nebulas.forEach((n, i) => {
      // deriva y respiración lentas: dan vida detrás del vidrio
      const cx = n.x * canvas.width + Math.sin(t * n.pulse + i) * 34
      const cy = n.y * canvas.height + Math.cos(t * n.pulse * 0.7 + i * 2) * 26
      const a = 0.15 * (0.75 + 0.25 * Math.sin(t * n.pulse * 1.6 + i))
      const color = nebColors[i]
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r)
      grd.addColorStop(0, `rgba(${color},${a})`)
      grd.addColorStop(1, `rgba(${color},0)`)
      ctx.fillStyle = grd
      ctx.fillRect(cx - n.r, cy - n.r, n.r * 2, n.r * 2)
    })

    stars.forEach(s => {
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase))
      s.x -= s.drift
      if (s.x < -3) s.x = canvas.width + 3

      // halo suave solo en las estrellas grandes (siguen visibles tras el blur)
      if (s.r > 1.3) {
        const halo = s.r * 6
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, halo)
        g.addColorStop(0, `rgba(${starColor},${alpha * 0.45})`)
        g.addColorStop(1, `rgba(${starColor},0)`)
        ctx.fillStyle = g
        ctx.fillRect(s.x - halo, s.y - halo, halo * 2, halo * 2)
      }

      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${starColor},${alpha})`
      ctx.fill()
    })

    t++
  }

  requestAnimationFrame(draw)
}
