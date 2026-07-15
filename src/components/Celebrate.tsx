import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  seed: number
  color: string
}

let trigger: (() => void) | null = null

/**
 * Fire the pixel-confetti burst from the bottom of the screen. Fire-and-forget:
 * drops silently when the host isn't mounted or the user prefers reduced
 * motion (the global reduced-motion CSS rule only neuters CSS animations,
 * not rAF loops, so the guard has to live here).
 */
export function celebrate(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  trigger?.()
}

// The backing store runs at 1/CHUNK of CSS resolution and gets stretched back
// up with image-rendering: pixelated — that scale factor IS the 8-bit look.
const CHUNK = 3
const COUNT = 40
const GRAVITY = 0.0006 // px/ms² in backing-store space

function spawn(canvas: HTMLCanvasElement, parts: Particle[]) {
  // re-fit lazily per burst: covers rotation/resize without listeners
  const w = Math.round(canvas.clientWidth / CHUNK)
  const h = Math.round(canvas.clientHeight / CHUNK)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  // read the palette per burst so it always matches the live theme
  const style = getComputedStyle(document.documentElement)
  const palette = ['--accent', '--good', '--danger', '--ink'].map((v) =>
    style.getPropertyValue(v).trim(),
  )
  for (let i = 0; i < COUNT; i++) {
    parts.push({
      x: w * (0.15 + Math.random() * 0.7),
      y: h + Math.random() * 8,
      vx: (Math.random() - 0.5) * 0.1,
      vy: -(0.3 + Math.random() * 0.18),
      age: 0,
      life: 950 + Math.random() * 300,
      seed: Math.random() * 7,
      color: palette[Math.floor(Math.random() * palette.length)]!,
    })
  }
}

/**
 * Mount once at the app root. Owns the overlay canvas and the rAF loop; the
 * loop only runs while a burst is alive, and repeat completions spawn into
 * the running loop so quick check-offs overlap naturally.
 */
export function CelebrateHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const parts: Particle[] = []
    let raf = 0
    let prev = 0

    const step = (now: number) => {
      // clamp dt so a throttled background tab can't teleport particles
      const dt = Math.min(34, now - prev)
      prev = now
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let alive = 0
      for (const p of parts) {
        p.age += dt
        if (p.age > p.life) continue
        parts[alive++] = p
        p.vy += GRAVITY * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // dying squares blink off every other 50ms tick
        if (p.life - p.age < 200 && Math.floor(p.age / 50) % 2 === 1) continue
        // tumble: the square flips between lying and standing as it spins
        const wide = Math.sin(p.age / 90 + p.seed) > 0
        ctx.fillStyle = p.color
        ctx.fillRect(Math.round(p.x), Math.round(p.y), wide ? 3 : 1, wide ? 1 : 3)
      }
      parts.length = alive
      if (parts.length > 0) {
        raf = requestAnimationFrame(step)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        raf = 0
      }
    }

    trigger = () => {
      spawn(canvas, parts)
      if (!raf) {
        prev = performance.now()
        raf = requestAnimationFrame(step)
      }
    }
    return () => {
      trigger = null
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return createPortal(
    <canvas
      ref={canvasRef}
      aria-hidden
      className="h-glass pointer-events-none fixed inset-x-0 top-0 z-[100] w-full"
      style={{ imageRendering: 'pixelated' }}
    />,
    document.body,
  )
}
