# Routine — daily routine & goal tracker

A personal PWA for tracking daily routines and long-term goals. Installs to an
iPhone home screen straight from the browser — no App Store, no developer
account. All data lives on-device in IndexedDB; there is no backend.

**Live app:** https://typeterson.github.io/daily-routine-tracker/

## Install on iPhone

1. Open the live URL in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Launch from the home screen icon — it runs full-screen, works offline, and
   shows an in-app banner when a new version has been deployed (tap it to update)

## Features

- **Today** — swipeable per-day checklist; tap the circle to mark a task done
- **Calendar** — month grid with per-day completion dots; tap a day to see and
  check off its tasks
- **Tasks** — notes, optional time of day, repeat once / every N days / weekly
  on chosen weekdays / monthly on a day, optional end date; link a task to any
  number of goals
- **Goals** — optional numeric metric (unit, start, target, direction — works
  for "run 1 mile" and "lose 20 lbs" alike), optional target date, sub-goals,
  ordered checkpoints (e.g. ½ mi → 1 mi → 5 mi), check-ins with values and
  notes that chart progress over time, and per-task weekly consistency bars
- **Native feel** — dark/light follows the system, pull-to-refresh, swipe
  between days/months, safe-area aware, works fully offline
- **Backups** — Settings → Export/Import a JSON backup (data exists only on
  the device, so export occasionally)

## Development

```sh
npm install
npm run dev       # dev server (no service worker)
npm test          # vitest — recurrence + progress engines
npm run build     # typecheck + production build + service worker
npm run preview   # serve the production build locally
```

Pushing to `main` runs `.github/workflows/deploy.yml`: install → test → build →
deploy to GitHub Pages. The app is served from `/daily-routine-tracker/` (see
`base` in [vite.config.ts](vite.config.ts)).

## Architecture

```
src/
  db/        Dexie (IndexedDB) schema + typed CRUD helpers
  domain/    pure logic: recurrence engine, progress math, date helpers (unit tested)
  features/  today / calendar / tasks / goals / settings screens
  components/ shared UI (sheets, nav, pull-to-refresh, update banner, …)
  hooks/     live-query hooks, swipe gestures
  pwa/       service-worker registration + update checks
```

Design decisions worth knowing before extending:

- **Occurrences are computed, never stored.** A task holds a recurrence rule;
  `domain/recurrence.ts` answers "does this occur on date X?" on the fly.
  Completions are one row per `(taskId, localDate)`. Changing a rule never
  requires backfilling.
- **Dates are local `YYYY-MM-DD` strings** everywhere scheduling is involved —
  no UTC conversions, no off-by-one-day bugs. Timestamps (`at`, `completedAt`)
  are epoch ms.
- **The DB schema is versioned** (`db/schema.ts`). To change it, add
  `db.version(2).stores(...).upgrade(...)` — never edit version 1; Dexie
  migrates on-device data automatically.
- **UI reads through `useLiveQuery`** (dexie-react-hooks), so any write
  anywhere updates every visible view automatically.
- Recharts is lazy-loaded (`GoalDetail`) to keep the main bundle small.

## Known limitations

- No reminders/notifications: a static GitHub Pages site has no push server,
  and iOS PWAs can't schedule local notifications. Would require a small
  server (or a push relay service) if ever wanted.
- Data is per-device with manual JSON backup/restore; there is no sync.
