export function initSpaceBg() {
  const canvas = document.getElementById('space-bg') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  const STAR_COUNT = 180
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: Math.random() * 1.2 + 0.2,
    alpha: Math.random() * 0.6 + 0.1,
    speed: Math.random() * 0.015 + 0.005,
    phase: Math.random() * Math.PI * 2,
  }))

  const nebulas = [
    { x: window.innerWidth * 0.15, y: window.innerHeight * 0.3, r: 280, color: '26,86,255' },
    { x: window.innerWidth * 0.8,  y: window.innerHeight * 0.6, r: 220, color: '10,40,180' },
    { x: window.innerWidth * 0.5,  y: window.innerHeight * 0.8, r: 180, color: '40,60,200' },
  ]

  let t = 0
  let last = 0

  // limitado a ~30fps y pausado con la ventana oculta: cada repintado
  // obliga a recalcular el blur de los paneles de vidrio encima
  function draw(now: number) {
    requestAnimationFrame(draw)
    if (now - last < 33 || document.hidden) return
    last = now

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    nebulas.forEach(n => {
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
      grd.addColorStop(0, `rgba(${n.color},0.04)`)
      grd.addColorStop(1, `rgba(${n.color},0)`)
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
    })

    stars.forEach(s => {
      const alpha = s.alpha * (0.6 + 0.4 * Math.sin(t * s.speed + s.phase))
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(180,210,255,${alpha})`
      ctx.fill()
    })

    t++
  }

  requestAnimationFrame(draw)
}