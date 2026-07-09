import { liveQuery } from 'dexie'
import { db } from '../../db/schema'
import { buildCalendar } from '../../domain/ics'

/**
 * Publishes the task schedule as an ICS file in a secret GitHub gist, giving
 * Apple Calendar a stable https URL to subscribe to. No server needed: the
 * app re-publishes (debounced) whenever tasks change while it's open.
 *
 * Secret gists are unlisted but readable by anyone who has the URL.
 */

const TOKEN_KEY = 'routine-cal-token'
const GIST_KEY = 'routine-cal-gist' // "owner/gistId"
const LAST_KEY = 'routine-cal-last'
const HASH_KEY = 'routine-cal-hash'
const FILE_NAME = 'routine.ics'

export interface CalendarSyncState {
  configured: boolean
  feedUrl?: string
  lastSync?: string
}

// raw URL without a commit sha always serves the latest revision
const rawUrl = (gist: string) => {
  const [owner, id] = gist.split('/')
  return `https://gist.githubusercontent.com/${owner}/${id}/raw/${FILE_NAME}`
}

export function getSyncState(): CalendarSyncState {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return { configured: false }
  const gist = localStorage.getItem(GIST_KEY)
  return {
    configured: true,
    feedUrl: gist ? rawUrl(gist) : undefined,
    lastSync: localStorage.getItem(LAST_KEY) ?? undefined,
  }
}

export function setSyncToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Forget the token and feed locally (the gist itself is left in place). */
export function clearSync(): void {
  for (const k of [TOKEN_KEY, GIST_KEY, LAST_KEY, HASH_KEY]) localStorage.removeItem(k)
}

const hashOf = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return String(h)
}

async function gistRequest(
  token: string,
  method: 'POST' | 'PATCH',
  id: string | null,
  ics: string,
): Promise<Response> {
  return fetch(`https://api.github.com/gists${id ? `/${id}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: 'routine — calendar feed (auto-published)',
      public: false,
      files: { [FILE_NAME]: { content: ics } },
    }),
  })
}

export async function publishCalendar(
  force = false,
): Promise<{ ok: boolean; feedUrl?: string; error?: string }> {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return { ok: false, error: 'not connected' }

  const tasks = await db.tasks.toArray()
  const ics = buildCalendar(tasks)
  const hash = hashOf(ics)
  const existing = localStorage.getItem(GIST_KEY)
  if (!force && existing && hash === localStorage.getItem(HASH_KEY)) {
    return { ok: true, feedUrl: rawUrl(existing) }
  }

  try {
    let resp = existing
      ? await gistRequest(token, 'PATCH', existing.split('/')[1]!, ics)
      : await gistRequest(token, 'POST', null, ics)
    if (resp.status === 404 && existing) {
      // gist was deleted on github — start a fresh one
      localStorage.removeItem(GIST_KEY)
      resp = await gistRequest(token, 'POST', null, ics)
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, error: 'github rejected the token — check its gist scope' }
    }
    if (!resp.ok) return { ok: false, error: `github error ${resp.status}` }

    const data = (await resp.json()) as { id: string; owner: { login: string } }
    const gist = `${data.owner.login}/${data.id}`
    localStorage.setItem(GIST_KEY, gist)
    localStorage.setItem(HASH_KEY, hash)
    localStorage.setItem(LAST_KEY, new Date().toISOString())
    return { ok: true, feedUrl: rawUrl(gist) }
  } catch {
    return { ok: false, error: 'network error — will retry on next change' }
  }
}

/** Watch the tasks table and re-publish (debounced) while connected. */
export function startCalendarAutoSync(): () => void {
  let timer: number | undefined
  const sub = liveQuery(() => db.tasks.toArray()).subscribe({
    next: () => {
      if (!localStorage.getItem(TOKEN_KEY)) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void publishCalendar(), 4000)
    },
    error: () => {},
  })
  return () => {
    sub.unsubscribe()
    window.clearTimeout(timer)
  }
}
