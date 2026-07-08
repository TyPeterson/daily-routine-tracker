import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Icon } from '../../components/Icon'
import { Screen } from '../../components/Screen'
import { Group, Row, SectionLabel } from '../../components/forms'
import { exportData, importData, type BackupData } from '../../db/repo'
import { todayStr } from '../../domain/dates'
import { checkForUpdates } from '../../pwa/useAppUpdate'

export default function SettingsView() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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
    setUpdateStatus('Checking…')
    await checkForUpdates()
    // if a new version was found the update banner takes it from here
    setTimeout(() => setUpdateStatus('Up to date (unless a banner appeared)'), 1200)
  }

  return (
    <Screen title="Settings">
      <div className="space-y-5">
        <section>
          <SectionLabel>Data</SectionLabel>
          <Group>
            <button
              type="button"
              onClick={() => void doExport()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-[16px]">Export backup</span>
              <Icon name="download" size={18} className="text-ink-dim" />
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-[16px]">Import backup</span>
              <Icon name="upload" size={18} className="text-ink-dim" />
            </button>
            <Row label="Protected storage">
              <span className="text-[15px] text-ink-dim">
                {persisted == null ? '—' : persisted ? 'Yes' : 'Not granted'}
              </span>
            </Row>
          </Group>
          <p className="mt-1.5 px-2 text-[12px] text-ink-dim">
            All data lives only on this device. Export a backup now and then in case you lose or
            replace your phone.
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
          <SectionLabel>App</SectionLabel>
          <Group>
            <Row label="Version">
              <span className="text-[15px] text-ink-dim">
                {format(new Date(__BUILD_DATE__), 'MMM d, yyyy h:mm a')}
              </span>
            </Row>
            <button
              type="button"
              onClick={() => void doCheckUpdates()}
              className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-[16px]">Check for updates</span>
              <span className="text-[13px] text-ink-dim">{updateStatus ?? ''}</span>
            </button>
            <a
              href="https://github.com/TyPeterson/daily-routine-tracker"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 w-full items-center justify-between px-4 py-2"
            >
              <span className="text-[16px]">Source on GitHub</span>
              <Icon name="chevron-right" size={16} className="text-ink-dim/60" />
            </a>
          </Group>
        </section>

        <section>
          <SectionLabel>Install on iPhone</SectionLabel>
          <div className="rounded-2xl bg-surface p-4 text-[14px] leading-relaxed text-ink-dim">
            Open this site in <span className="font-semibold text-ink">Safari</span>, tap the{' '}
            <span className="font-semibold text-ink">Share</span> button, then{' '}
            <span className="font-semibold text-ink">Add to Home Screen</span>. It launches
            full-screen, works offline, and updates itself when new versions are deployed.
          </div>
        </section>
      </div>
    </Screen>
  )
}
