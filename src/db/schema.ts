import Dexie, { type EntityTable } from 'dexie'
import type { CheckIn, Checkpoint, Completion, Goal, Task } from './models'

export type AppDB = Dexie & {
  tasks: EntityTable<Task, 'id'>
  completions: EntityTable<Completion, 'id'>
  goals: EntityTable<Goal, 'id'>
  checkpoints: EntityTable<Checkpoint, 'id'>
  checkIns: EntityTable<CheckIn, 'id'>
}

export const db = new Dexie('daily-routine-tracker') as AppDB

// Schema changes = bump the version and add an upgrade block; Dexie migrates
// existing on-device data automatically. Never edit a shipped version line.
db.version(1).stores({
  tasks: 'id, *goalIds, archivedAt, createdAt',
  completions: 'id, &[taskId+date], taskId, date',
  goals: 'id, parentGoalId, archivedAt, createdAt',
  checkpoints: 'id, goalId, sortOrder',
  checkIns: 'id, goalId, at, checkpointId',
})
