import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { alertDialog, confirmDialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { Group, Row, SectionLabel, Segmented } from '../../components/forms'
import { exportData, importData, type BackupData } from '../../db/repo'
import { todayStr } from '../../domain/dates'
import { checkForUpdates } from '../../pwa/useAppUpdate'
import { applyThemePref, getThemePref, type ThemePref } from '../../theme'
import {
  clearSync,
  getSyncState,
  publishCalendar,
  setSyncToken,
} from './calendarSync'

/** Measure how a CSS length actually resolves on this device. */
function probeCssHeight(height: string): number {
  const d = document.createElement('div')
  d.style.cssText = `position:absolute;left:-9999px;top:0;width:1px;height:${height};`
  document.body.appendChild(d)
  const v = d.getBoundingClientRect().height
  d.remove()
  return Math.round(v)
}

/** Viewport ground truth for debugging layout gaps — shown on version tap. */
function readViewportDiag(): string {
  const root = document.getElementById('root')?.getBoundingClientRect()
  const nav = document.querySelector('nav')?.getBoundingClientRect()
  const html = document.documentElement.getBoundingClientRect()
  return [
    `standalone ${matchMedia('(display-mode: standalone)').matches}`,
    `screen ${screen.width}×${screen.height}  innerH ${window.innerHeight}`,
    `vvH ${Math.round(window.visualViewport?.height ?? 0)}  vvTop ${Math.round(window.visualViewport?.offsetTop ?? 0)}  scrollY ${Math.round(window.scrollY)}`,
    `dvh ${probeCssHeight('100dvh')}  svh ${probeCssHeight('100svh')}  lvh ${probeCssHeight('100lvh')}`,
    `htmlH ${Math.round(html.height)}  safeBottom ${probeCssHeight('env(safe-area-inset-bottom)')}`,
    `rootH ${root ? Math.round(root.height) : '-'}  navBottom ${nav ? Math.round(nav.bottom) : '-'}`,
  ].join('\n')
}

export default function SettingsView() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [diag, setDiag] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref())
  const [sync, setSync] = useState(() => getSyncState())
  const [tokenInput, setTokenInput] = useState('')
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const connectCalendar = async () => {
    const token = tokenInput.trim()
    if (!token) return
    setSyncToken(token)
    setSyncStatus('publishing…')
    const result = await publishCalendar(true)
    if (result.ok) {
      setTokenInput('')
      setSyncStatus('feed published')
    } else {
      clearSync()
      setSyncStatus(result.error ?? 'failed')
    }
    setSync(getSyncState())
  }

  const syncNow = async () => {
    setSyncStatus('publishing…')
    const result = await publishCalendar(true)
    setSyncStatus(result.ok ? 'up to date' : (result.error ?? 'failed'))
    setSync(getSyncState())
  }

  const copyFeed = async () => {
    if (!sync.feedUrl) return
    await navigator.clipboard.writeText(sync.feedUrl)
    setSyncStatus('link copied')
  }

  const disconnectCalendar = async () => {
    const ok = await confirmDialog({
      title: 'disconnect calendar feed?',
      message:
        'the token is forgotten and publishing stops. the feed file stays on github until you delete the gist.',
      confirmLabel: 'disconnect',
      danger: true,
    })
    if (!ok) return
    clearSync()
    setSyncStatus(null)
    setSync(getSyncState())
  }

  const changeTheme = (pref: ThemePref) => {
    setTheme(pref)
    applyThemePref(pref)
  }

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null))
  }, [])

  const doExport = async () => {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `routine-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as BackupData
      const when = data.exportedAt
        ? format(new Date(data.exportedAt), 'MMM d, yyyy').toLowerCase()
        : 'an unknown date'
      const ok = await confirmDialog({
        title: 'restore backup?',
        message: `all current data will be replaced with the backup from ${when}.`,
        confirmLabel: 'restore',
        danger: true,
      })
      if (!ok) return
      await importData(data)
      await alertDialog({ title: 'backup restored' })
    } catch (err) {
      await alertDialog({
        title: 'import failed',
        message: err instanceof Error ? err.message : 'invalid file',
      })
    }
  }

  const doCheckUpdates = async () => {
    setUpdateStatus('checking…')
    await checkForUpdates()
    // if a new version was found the update banner takes it from here
    setTimeout(() => setUpdateStatus('up to date (unless a banner appeared)'), 1200)
  }

  return (
    <Screen title="settings" subtitle="routine">
      <div className="space-y-5">
        <section>
          <SectionLabel index="01">appearance</SectionLabel>
          <Segmented
            value={theme}
            onChange={changeTheme}
            options={[
              { value: 'system', label: 'system' },
              { value: 'light', label: 'light' },
              { value: 'dark', label: 'dark' },
            ]}
          />
        </section>

        <section>
          <SectionLabel index="02">calendar feed</SectionLabel>
          {!sync.configured ? (
            <>
              <Group>
                <div className="p-4 text-[13px] leading-relaxed text-ink-dim">
                  publish your schedule as a subscription link for apple calendar. it lives in a
                  secret github gist — unlisted, but anyone with the link can read task titles.
                  needs a github token with only the <span className="font-bold text-ink">gist</span>{' '}
                  scope (classic token, github.com → settings → developer settings).
                </div>
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <input
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    type="password"
                    placeholder="github token"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-[7px] border border-edge/50 bg-surface2 px-2.5 py-1.5 text-[14px] outline-none placeholder:text-ink-dim/60"
                  />
                  <button
                    type="button"
                    onClick={() => void connectCalendar()}
                    className={`key key-primary px-3.5 py-1.5 text-[13px] font-bold ${
                      tokenInput.trim() ? '' : 'opacity-40'
                    }`}
                  >
                    connect
                  </button>
                </div>
              </Group>
              {syncStatus && (
                <p className="mt-1.5 px-1 text-[11px] font-semibold text-ink-dim">{syncStatus}</p>
              )}
            </>
          ) : (
            <>
              <Group>
                <div className="flex items-center gap-2 px-4 py-3">
                  <Icon name="link" size={15} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-dim">
                    {sync.feedUrl ?? 'not published yet'}
                  </span>
                  {sync.feedUrl && (
                    <button
                      type="button"
                      onClick={() => void copyFeed()}
                      className="key shrink-0 px-3 py-1.5 text-[12px] font-bold text-accent"
                    >
                      copy
                    </button>
                  )}
                </div>
                {sync.feedUrl && (
                  <a
                    href={sync.feedUrl.replace('https://', 'webcal://')}
                    className="flex min-h-12 w-full items-center justify-between px-4 py-2 transition-colors duration-150 active:bg-surface2/60"
                  >
                    <span className="text-[15px]">subscribe in apple calendar</span>
                    <Icon name="chevron-right" size={15} className="text-ink-dim/60" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
                >
                  <span className="text-[15px]">sync now</span>
                  <span className="text-[12px] text-ink-dim">{syncStatus ?? ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void disconnectCalendar()}
                  className="flex min-h-12 w-full items-center px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
                >
                  <span className="text-[15px] text-danger">disconnect</span>
                </button>
              </Group>
              <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
                republishes automatically when tasks change while the app is open. apple refreshes
                subscriptions on its own schedule.
              </p>
            </>
          )}
        </section>

        <section>
          <SectionLabel index="03">data</SectionLabel>
          <Group>
            <button
              type="button"
              onClick={() => void doExport()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
            >
              <span className="text-[15px]">export backup</span>
              <Icon name="download" size={17} className="text-ink-dim" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
            >
              <span className="text-[15px]">import backup</span>
              <Icon name="upload" size={17} className="text-ink-dim" />
            </button>
            <Row label="protected storage">
              <span className="flex items-center gap-2 text-[14px] text-ink-dim">
                <span className={`led ${persisted ? 'led-good' : ''}`} />
                {persisted == null ? '—' : persisted ? 'yes' : 'not granted'}
              </span>
            </Row>
          </Group>
          <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
            all data lives only on this device. export a backup first if you re-add the app to
            your home screen — re-adding wipes saved data.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doImport(f)
              e.target.value = ''
            }}
          />
        </section>

        <section>
          <SectionLabel index="04">app</SectionLabel>
          <Group>
            <Row label="version">
              {/* tap toggles a viewport readout for debugging layout gaps */}
              <button
                type="button"
                onClick={() => setDiag((d) => (d ? null : readViewportDiag()))}
                className="text-[14px] font-bold text-accent"
              >
                v{__APP_VERSION__}
              </button>
            </Row>
            {diag && (
              <div className="px-4 pb-3 text-[11px] leading-relaxed whitespace-pre-wrap text-ink-dim select-text">
                {diag}
              </div>
            )}
            <Row label="updated">
              <span className="text-[13px] text-ink-dim">
                {format(new Date(__BUILD_DATE__), 'MMM d, yyyy h:mm a').toLowerCase()}
              </span>
            </Row>
            <button
              type="button"
              onClick={() => void doCheckUpdates()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
            >
              <span className="text-[15px]">check for updates</span>
              <span className="text-[12px] text-ink-dim">{updateStatus ?? ''}</span>
            </button>
            <a
              href="https://github.com/TyPeterson/daily-routine-tracker"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 transition-colors duration-150 active:bg-surface2/60"
            >
              <span className="text-[15px]">source on github</span>
              <Icon name="chevron-right" size={15} className="text-ink-dim/60" />
            </a>
          </Group>
        </section>

      </div>
    </Screen>
  )
}
