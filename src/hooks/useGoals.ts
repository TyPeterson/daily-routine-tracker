import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import type { Goal } from '../db/models'

export function useActiveGoals(): Goal[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.goals.toArray())
        .filter((g) => !g.archivedAt)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [],
  )
}

export function useGoalsMap(): Map<string, Goal> {
  const goals = useActiveGoals()
  return useMemo(() => new Map((goals ?? []).map((g) => [g.id, g])), [goals])
}
