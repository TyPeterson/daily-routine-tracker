import { db } from './schema'
import type { CheckIn, Checkpoint, Completion, Goal, Task } from './models'
import type { DateStr } from '../domain/dates'
import { valueCrosses } from '../domain/progress'

const newId = () => crypto.randomUUID()

// ---------- tasks ----------

export async function createTask(input: Omit<Task, 'id' | 'createdAt'>): Promise<string> {
  const id = newId()
  await db.tasks.add({ ...input, id, createdAt: Date.now() })
  return id
}

export async function updateTask(id: string, changes: Partial<Omit<Task, 'id'>>): Promise<void> {
  await db.tasks.update(id, changes)
}

export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.completions.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

/** Mark/unmark the task done on a date (one completion row per occurrence). */
export async function toggleCompletion(taskId: string, date: DateStr): Promise<void> {
  await db.transaction('rw', db.completions, async () => {
    const existing = await db.completions.where('[taskId+date]').equals([taskId, date]).first()
    if (existing) {
      await db.completions.delete(existing.id)
    } else {
      await db.completions.add({ id: newId(), taskId, date, completedAt: Date.now() })
    }
  })
}

// ---------- goals ----------

export async function createGoal(input: Omit<Goal, 'id' | 'createdAt'>): Promise<string> {
  const id = newId()
  await db.goals.add({ ...input, id, createdAt: Date.now() })
  return id
}

export async function updateGoal(id: string, changes: Partial<Omit<Goal, 'id'>>): Promise<void> {
  await db.goals.update(id, changes)
}

export async function archiveGoal(id: string): Promise<void> {
  await db.goals.update(id, { archivedAt: Date.now() })
}

export async function unarchiveGoal(id: string): Promise<void> {
  await db.goals
    .where('id')
    .equals(id)
    .modify((g) => {
      delete g.archivedAt
    })
}

/**
 * Delete a goal and everything that only makes sense inside it (checkpoints,
 * check-ins). Sub-goals are kept and promoted to top level; linked tasks are
 * kept and unlinked.
 */
export async function deleteGoal(id: string): Promise<void> {
  await db.transaction('rw', [db.goals, db.checkpoints, db.checkIns, db.tasks], async () => {
    await db.goals
      .where('parentGoalId')
      .equals(id)
      .modify((g) => {
        delete g.parentGoalId
      })
    await db.tasks
      .where('goalIds')
      .equals(id)
      .modify((t) => {
        t.goalIds = t.goalIds.filter((g) => g !== id)
      })
    await db.checkpoints.where('goalId').equals(id).delete()
    await db.checkIns.where('goalId').equals(id).delete()
    await db.goals.delete(id)
  })
}

// ---------- check-ins & checkpoints ----------

/**
 * Derive checkpoint achievement from the check-in record: a checkpoint is
 * achieved at the moment of the earliest check-in whose value crosses it.
 * Called inside any transaction that changes check-ins or checkpoints.
 */
async function recomputeCheckpointAchievements(goalId: string): Promise<void> {
  const goal = await db.goals.get(goalId)
  const direction = goal?.metric?.direction
  const [checkpoints, checkIns] = await Promise.all([
    db.checkpoints.where('goalId').equals(goalId).toArray(),
    db.checkIns.where('goalId').equals(goalId).toArray(),
  ])
  const valued = checkIns
    .filter((c) => c.value != null)
    .sort((a, b) => a.at - b.at)
  for (const cp of checkpoints) {
    if (cp.targetValue == null || !direction) continue
    const hit = valued.find((ci) => valueCrosses(direction, ci.value!, cp.targetValue!))
    const achievedAt = hit?.at
    if (achievedAt !== cp.achievedAt) {
      await db.checkpoints
        .where('id')
        .equals(cp.id)
        .modify((c) => {
          if (achievedAt == null) delete c.achievedAt
          else c.achievedAt = achievedAt
        })
    }
  }
}

/** Record progress; any checkpoints the value crosses become achieved. */
export async function addCheckIn(input: Omit<CheckIn, 'id'>): Promise<string> {
  return db.transaction('rw', [db.checkIns, db.checkpoints, db.goals], async () => {
    const id = newId()
    await db.checkIns.add({ ...input, id })
    await recomputeCheckpointAchievements(input.goalId)
    return id
  })
}

export async function deleteCheckIn(id: string): Promise<void> {
  await db.transaction('rw', [db.checkIns, db.checkpoints, db.goals], async () => {
    const checkIn = await db.checkIns.get(id)
    if (!checkIn) return
    await db.checkIns.delete(id)
    await recomputeCheckpointAchievements(checkIn.goalId)
  })
}

export async function addCheckpoint(goalId: string, targetValue: number): Promise<string> {
  return db.transaction('rw', [db.checkpoints, db.checkIns, db.goals], async () => {
    const siblings = await db.checkpoints.where('goalId').equals(goalId).toArray()
    const sortOrder = Math.max(0, ...siblings.map((c) => c.sortOrder)) + 1
    const id = newId()
    await db.checkpoints.add({ id, goalId, targetValue, sortOrder })
    // a past check-in may already cross the new checkpoint
    await recomputeCheckpointAchievements(goalId)
    return id
  })
}

export async function updateCheckpoint(
  id: string,
  changes: Partial<Omit<Checkpoint, 'id' | 'goalId'>>,
): Promise<void> {
  await db.checkpoints.update(id, changes)
}

export async function deleteCheckpoint(id: string): Promise<void> {
  await db.checkpoints.delete(id)
}

// ---------- backup ----------

export interface BackupData {
  app: 'daily-routine-tracker'
  version: 1
  exportedAt: string
  tasks: Task[]
  completions: Completion[]
  goals: Goal[]
  checkpoints: Checkpoint[]
  checkIns: CheckIn[]
}

export async function exportData(): Promise<BackupData> {
  const [tasks, completions, goals, checkpoints, checkIns] = await Promise.all([
    db.tasks.toArray(),
    db.completions.toArray(),
    db.goals.toArray(),
    db.checkpoints.toArray(),
    db.checkIns.toArray(),
  ])
  return {
    app: 'daily-routine-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    completions,
    goals,
    checkpoints,
    checkIns,
  }
}

/** Replace everything with the backup's contents. */
export async function importData(data: BackupData): Promise<void> {
  if (data.app !== 'daily-routine-tracker' || !Array.isArray(data.tasks)) {
    throw new Error('Not a valid Routine backup file')
  }
  await db.transaction(
    'rw',
    [db.tasks, db.completions, db.goals, db.checkpoints, db.checkIns],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.completions.clear(),
        db.goals.clear(),
        db.checkpoints.clear(),
        db.checkIns.clear(),
      ])
      await db.tasks.bulkAdd(data.tasks)
      await db.completions.bulkAdd(data.completions ?? [])
      await db.goals.bulkAdd(data.goals ?? [])
      await db.checkpoints.bulkAdd(data.checkpoints ?? [])
      await db.checkIns.bulkAdd(data.checkIns ?? [])
    },
  )
}
