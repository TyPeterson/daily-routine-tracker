import { db } from './schema'
import type { CheckIn, Checkpoint, Completion, Friend, Goal, Meta, Settlement, Task } from './models'
import { addDaysStr, type DateStr } from '../domain/dates'
import { milestoneAchievedAt } from '../domain/progress'
import { occursOn } from '../domain/recurrence'

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

/** Erase the task and its completion history entirely. */
export async function deleteTask(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.completions.where('taskId').equals(id).delete()
    await db.tasks.delete(id)
  })
}

/**
 * Add an occurrence on a day the rule doesn't produce (logging an extra run).
 * A previously deleted rule day is restored by un-skipping instead, so the
 * series never tracks the same day twice.
 */
export async function addExtraOccurrence(taskId: string, date: DateStr): Promise<void> {
  await db.tasks
    .where('id')
    .equals(taskId)
    .modify((t) => {
      if (t.skipDates?.includes(date)) t.skipDates = t.skipDates.filter((d) => d !== date)
      if (!occursOn(t, date)) t.extraDates = [...(t.extraDates ?? []), date]
    })
}

/** Remove a single occurrence from a series (and its completion, if any). */
export async function deleteOccurrence(taskId: string, date: DateStr): Promise<void> {
  await db.transaction('rw', db.tasks, db.completions, async () => {
    await db.tasks
      .where('id')
      .equals(taskId)
      .modify((t) => {
        if (t.extraDates?.includes(date)) t.extraDates = t.extraDates.filter((d) => d !== date)
        else t.skipDates = [...(t.skipDates ?? []), date]
      })
    await db.completions.where('[taskId+date]').equals([taskId, date]).delete()
  })
}

/**
 * Stop the series from `date` onward while keeping past occurrences and
 * their completion history. A series with no past left is simply deleted.
 */
export async function endSeriesBefore(taskId: string, date: DateStr): Promise<void> {
  await db.transaction('rw', db.tasks, db.completions, async () => {
    const task = await db.tasks.get(taskId)
    if (!task) return
    const lastKept = addDaysStr(date, -1)
    // extras ignore endDate, so future ones must be pruned explicitly
    const keptExtras = (task.extraDates ?? []).filter((d) => d < date)
    if (lastKept < task.startDate && keptExtras.length === 0) {
      await db.completions.where('taskId').equals(taskId).delete()
      await db.tasks.delete(taskId)
      return
    }
    await db.tasks
      .where('id')
      .equals(taskId)
      .modify((t) => {
        t.endDate = lastKept
        if (keptExtras.length > 0) t.extraDates = keptExtras
        else delete t.extraDates
      })
    // completions logged on now-removed future occurrences make no sense
    await db.completions
      .where('taskId')
      .equals(taskId)
      .filter((c) => c.date >= date)
      .delete()
  })
}

/**
 * "Edit only this day": the occurrence becomes its own one-off task carrying
 * the edited fields; the original series skips that date. An existing
 * completion follows the split-off task.
 */
export async function splitOccurrence(
  taskId: string,
  date: DateStr,
  payload: Omit<Task, 'id' | 'createdAt' | 'recurrence' | 'startDate' | 'endDate' | 'skipDates'>,
): Promise<string> {
  return db.transaction('rw', db.tasks, db.completions, async () => {
    const newId = crypto.randomUUID()
    await db.tasks.add({
      ...payload,
      id: newId,
      recurrence: { type: 'none' },
      startDate: date,
      createdAt: Date.now(),
    })
    await db.tasks
      .where('id')
      .equals(taskId)
      .modify((t) => {
        if (t.extraDates?.includes(date)) t.extraDates = t.extraDates.filter((d) => d !== date)
        else t.skipDates = [...(t.skipDates ?? []), date]
      })
    await db.completions
      .where('[taskId+date]')
      .equals([taskId, date])
      .modify((c) => {
        c.taskId = newId
      })
    return newId
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

export async function archiveGoal(
  id: string,
  opts?: { includeSubGoals?: boolean },
): Promise<void> {
  const at = Date.now()
  await db.transaction('rw', db.goals, async () => {
    await db.goals.update(id, { archivedAt: at })
    if (opts?.includeSubGoals) {
      await db.goals
        .where('parentGoalId')
        .equals(id)
        .modify((g) => {
          g.archivedAt = at
        })
    }
  })
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
 * Delete a goal and everything that only makes sense inside it (milestones,
 * check-ins). Sub-goals are either promoted to top level (default) or deleted
 * along with it; linked tasks are always kept and unlinked.
 */
export async function deleteGoal(
  id: string,
  opts?: { includeSubGoals?: boolean },
): Promise<void> {
  await db.transaction('rw', [db.goals, db.checkpoints, db.checkIns, db.tasks], async () => {
    const childIds = (await db.goals.where('parentGoalId').equals(id).toArray()).map((g) => g.id)
    const targets = opts?.includeSubGoals ? [id, ...childIds] : [id]
    if (!opts?.includeSubGoals) {
      await db.goals
        .where('parentGoalId')
        .equals(id)
        .modify((g) => {
          delete g.parentGoalId
        })
    }
    await db.tasks
      .where('goalIds')
      .anyOf(targets)
      .modify((t) => {
        t.goalIds = t.goalIds.filter((g) => !targets.includes(g))
      })
    await db.checkpoints.where('goalId').anyOf(targets).delete()
    await db.checkIns.where('goalId').anyOf(targets).delete()
    await db.goals.bulkDelete(targets)
  })
}

// ---------- check-ins & checkpoints ----------

/**
 * Derive milestone achievement from the check-in record. Only the crossing
 * streak that runs through the latest check-in counts, so backwards progress
 * (weight back up over a passed milestone) un-reaches it automatically.
 * Called inside any transaction that changes check-ins or milestones.
 */
async function recomputeCheckpointAchievements(goalId: string): Promise<void> {
  const goal = await db.goals.get(goalId)
  const direction = goal?.metric?.direction
  const [checkpoints, checkIns] = await Promise.all([
    db.checkpoints.where('goalId').equals(goalId).toArray(),
    db.checkIns.where('goalId').equals(goalId).toArray(),
  ])
  const valued = checkIns
    .filter((c): c is CheckIn & { value: number } => c.value != null)
    .sort((a, b) => a.at - b.at)
  for (const cp of checkpoints) {
    if (cp.targetValue == null || !direction) continue
    const achievedAt = milestoneAchievedAt(direction, cp.targetValue, valued)
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

// ---------- friends ----------

export async function createFriend(input: Omit<Friend, 'id' | 'createdAt'>): Promise<string> {
  const id = newId()
  await db.friends.add({ ...input, id, createdAt: Date.now() })
  return id
}

export async function updateFriend(
  id: string,
  changes: Partial<Omit<Friend, 'id'>>,
): Promise<void> {
  await db.friends.update(id, changes)
}

/** Delete a friend and clear the wager off any task that pointed at them. */
export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.tasks, async () => {
    await db.tasks
      .filter((t) => t.wagerFriendId === id)
      .modify((t) => {
        delete t.wagerCents
        delete t.wagerFriendId
      })
    await db.friends.delete(id)
  })
}

// ---------- settlements & meta ----------

export const SETTLED_THROUGH_KEY = 'settledThrough'

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db.meta.get(key))?.value
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

/** Stamp paidAt on this friend's payout lines in every pending settlement. */
export async function markFriendPaid(friendId: string): Promise<void> {
  const at = Date.now()
  await db.transaction('rw', db.settlements, async () => {
    await db.settlements
      .filter((s) => s.acknowledgedAt == null)
      .modify((s) => {
        for (const p of s.payouts) {
          if (p.friendId === friendId && p.paidAt == null) p.paidAt = at
        }
      })
  })
}

/** Close the settlement popup: stamp acknowledgedAt on all pending records. */
export async function acknowledgePendingSettlements(): Promise<void> {
  const at = Date.now()
  await db.settlements
    .filter((s) => s.acknowledgedAt == null)
    .modify((s) => {
      s.acknowledgedAt = at
    })
}

// ---------- backup ----------

export interface BackupData {
  app: 'daily-routine-tracker'
  /** 1 = pre-payments backups (no friends/settlements/meta) */
  version: number
  exportedAt: string
  tasks: Task[]
  completions: Completion[]
  goals: Goal[]
  checkpoints: Checkpoint[]
  checkIns: CheckIn[]
  friends?: Friend[]
  settlements?: Settlement[]
  meta?: Meta[]
}

export async function exportData(): Promise<BackupData> {
  const [tasks, completions, goals, checkpoints, checkIns, friends, settlements, meta] =
    await Promise.all([
      db.tasks.toArray(),
      db.completions.toArray(),
      db.goals.toArray(),
      db.checkpoints.toArray(),
      db.checkIns.toArray(),
      db.friends.toArray(),
      db.settlements.toArray(),
      db.meta.toArray(),
    ])
  return {
    app: 'daily-routine-tracker',
    version: 2,
    exportedAt: new Date().toISOString(),
    tasks,
    completions,
    goals,
    checkpoints,
    checkIns,
    friends,
    settlements,
    meta,
  }
}

/** Replace everything with the backup's contents. */
export async function importData(data: BackupData): Promise<void> {
  if (data.app !== 'daily-routine-tracker' || !Array.isArray(data.tasks)) {
    throw new Error('Not a valid Routine backup file')
  }
  await db.transaction(
    'rw',
    [db.tasks, db.completions, db.goals, db.checkpoints, db.checkIns, db.friends, db.settlements, db.meta],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.completions.clear(),
        db.goals.clear(),
        db.checkpoints.clear(),
        db.checkIns.clear(),
        db.friends.clear(),
        db.settlements.clear(),
        db.meta.clear(),
      ])
      await db.tasks.bulkAdd(data.tasks)
      await db.completions.bulkAdd(data.completions ?? [])
      await db.goals.bulkAdd(data.goals ?? [])
      await db.checkpoints.bulkAdd(data.checkpoints ?? [])
      await db.checkIns.bulkAdd(data.checkIns ?? [])
      // v1 backups predate these tables; a cleared meta table simply makes
      // settlement re-anchor to last Saturday (no retroactive billing)
      await db.friends.bulkAdd(data.friends ?? [])
      await db.settlements.bulkAdd(data.settlements ?? [])
      await db.meta.bulkAdd(data.meta ?? [])
    },
  )
}
