import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { Group, Row, SectionLabel, Segmented } from '../../components/forms'
import { exportData, importData, type BackupData } from '../../db/repo'
import { todayStr } from '../../domain/dates'
import { checkForUpdates } from '../../pwa/useAppUpdate'
import { applyThemePref, getThemePref, type ThemePref } from '../../theme'

export default function SettingsView() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref())
  const fileRef = useRef<HTMLInputElement>(null)

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
      const when = data.exportedAt ? format(new Date(data.exportedAt), 'MMM d, yyyy') : 'unknown date'
      if (!window.confirm(`Replace ALL current data with the backup from ${when}?`)) return
      await importData(data)
      window.alert('Backup restored.')
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : 'invalid file'}`)
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
          <SectionLabel index="02">data</SectionLabel>
          <Group>
            <button
              type="button"
              onClick={() => void doExport()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-[15px]">export backup</span>
              <Icon name="download" size={17} className="text-ink-dim" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
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
          <SectionLabel index="03">app</SectionLabel>
          <Group>
            <Row label="version">
              <span className="text-[14px] font-bold text-accent">v{__APP_VERSION__}</span>
            </Row>
            <Row label="updated">
              <span className="text-[13px] text-ink-dim">
                {format(new Date(__BUILD_DATE__), 'MMM d, yyyy h:mm a').toLowerCase()}
              </span>
            </Row>
            <button
              type="button"
              onClick={() => void doCheckUpdates()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-[15px]">check for updates</span>
              <span className="text-[12px] text-ink-dim">{updateStatus ?? ''}</span>
            </button>
            <a
              href="https://github.com/TyPeterson/daily-routine-tracker"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 w-full items-center justify-between px-4 py-2"
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
