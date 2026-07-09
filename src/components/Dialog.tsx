import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DialogChoice {
  id: string
  label: string
  /** 'primary' = orange key, 'danger' = red key, default = plain key */
  kind?: 'primary' | 'danger'
  /** smaller secondary line under the label */
  detail?: string
}

interface DialogRequest {
  title: string
  message?: string
  choices: DialogChoice[]
  showCancel: boolean
  resolve: (id: string | null) => void
}

let enqueue: ((r: DialogRequest) => void) | null = null
const pending: DialogRequest[] = []

function request(r: Omit<DialogRequest, 'resolve'>): Promise<string | null> {
  return new Promise((resolve) => {
    const req = { ...r, resolve }
    if (enqueue) enqueue(req)
    else pending.push(req)
  })
}

/** Themed replacement for window.confirm. Resolves true when confirmed. */
export async function confirmDialog(opts: {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}): Promise<boolean> {
  const id = await request({
    title: opts.title,
    message: opts.message,
    choices: [
      {
        id: 'confirm',
        label: opts.confirmLabel ?? 'confirm',
        kind: opts.danger ? 'danger' : 'primary',
      },
    ],
    showCancel: true,
  })
  return id === 'confirm'
}

/** Themed multi-option prompt. Resolves the chosen id, or null on cancel. */
export function choiceDialog(opts: {
  title: string
  message?: string
  choices: DialogChoice[]
}): Promise<string | null> {
  return request({ ...opts, showCancel: true })
}

/** Themed replacement for window.alert. */
export async function alertDialog(opts: { title: string; message?: string }): Promise<void> {
  await request({
    title: opts.title,
    message: opts.message,
    choices: [{ id: 'ok', label: 'ok', kind: 'primary' }],
    showCancel: false,
  })
}

/** Mount once at the app root; renders whatever dialog is currently queued. */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([])

  useEffect(() => {
    enqueue = (r) => setQueue((q) => [...q, r])
    if (pending.length) {
      const drained = [...pending]
      pending.length = 0
      setQueue((q) => [...q, ...drained])
    }
    return () => {
      enqueue = null
    }
  }, [])

  const current = queue[0]
  if (!current) return null

  const close = (id: string | null) => {
    current.resolve(id)
    setQueue((q) => q.slice(1))
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
      <div
        className="animate-fade-in absolute inset-0 bg-black/50"
        onClick={() => (current.showCancel ? close(null) : undefined)}
      />
      <div className="module animate-pop-in relative w-full max-w-sm p-5">
        <h2 className="text-[16px] font-bold tracking-tight">{current.title}</h2>
        {current.message && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{current.message}</p>
        )}
        <div className="mt-4 space-y-2.5">
          {current.choices.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => close(c.id)}
              className={`key w-full px-3 py-2.5 text-[14px] font-bold ${
                c.kind === 'primary' ? 'key-primary' : c.kind === 'danger' ? 'key-danger' : ''
              }`}
            >
              {c.label}
              {c.detail && (
                <span
                  className={`block text-[11px] font-semibold ${
                    c.kind ? 'opacity-80' : 'text-ink-dim'
                  }`}
                >
                  {c.detail}
                </span>
              )}
            </button>
          ))}
          {current.showCancel && (
            <button
              type="button"
              onClick={() => close(null)}
              className="w-full py-2 text-[13px] font-bold text-ink-dim"
            >
              cancel
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
