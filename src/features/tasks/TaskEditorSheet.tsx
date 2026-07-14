import { useState } from 'react'
import { createPortal } from 'react-dom'
import { getDate, getDay } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { confirmDialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { NumberField } from '../../components/NumberField'
import { Sheet } from '../../components/Sheet'
import { TimeSelect } from '../../components/TimeSelect'
import { Group, Row, SectionLabel, Segmented, Toggle } from '../../components/forms'
import { ColorPicker, EmojiPicker } from '../../components/pickers'
import { db } from '../../db/schema'
import {
  addExtraOccurrence,
  createTask,
  deleteOccurrence,
  deleteTask,
  endSeriesBefore,
  splitOccurrence,
  updateTask,
} from '../../db/repo'
import type { Task } from '../../db/models'
import { addDaysStr, fromDateStr, type DateStr } from '../../domain/dates'
import { describeRecurrence, occursOn, type Recurrence } from '../../domain/recurrence'
import { effectiveTaskColor } from '../../domain/taskColor'
import { useActiveGoals } from '../../hooks/useGoals'
import { useKeyboardInset } from '../../hooks/useVisualViewport'

const WEEKDAY_CHIPS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function TaskEditorSheet({
  task,
  defaultDate,
  onClose,
}: {
  task?: Task
  defaultDate: DateStr
  onClose: () => void
}) {
  const goals = useActiveGoals()
  const rec = task?.recurrence

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [startDate, setStartDate] = useState(task?.startDate ?? defaultDate)
  const [recType, setRecType] = useState<Recurrence['type']>(rec?.type ?? 'daily')
  const [interval, setIntervalN] = useState(rec && rec.type !== 'none' ? rec.interval : 1)
  const [weekdays, setWeekdays] = useState<number[]>(
    rec?.type === 'weekly' ? rec.weekdays : [getDay(fromDateStr(task?.startDate ?? defaultDate))],
  )
  const [dayOfMonth, setDayOfMonth] = useState(
    rec?.type === 'monthly' ? rec.dayOfMonth : getDate(fromDateStr(task?.startDate ?? defaultDate)),
  )
  const [hasEnd, setHasEnd] = useState(task?.endDate != null)
  const [endDate, setEndDate] = useState(task?.endDate ?? addDaysStr(defaultDate, 30))
  const [hasTime, setHasTime] = useState(task?.timeOfDay != null)
  const [timeOfDay, setTimeOfDay] = useState(task?.timeOfDay ?? '08:00')
  const [goalIds, setGoalIds] = useState<string[]>(task?.goalIds ?? [])
  const [color, setColor] = useState<string | undefined>(task?.color)
  const [icon, setIcon] = useState<string | undefined>(task?.icon)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [scopeAsk, setScopeAsk] = useState<null | 'save' | 'delete'>(null)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [extraDate, setExtraDate] = useState(defaultDate)
  const [extraTaskId, setExtraTaskId] = useState<string | null>(null)

  const keyboardInset = useKeyboardInset()

  const completionCount =
    useLiveQuery(
      async () => (task ? db.completions.where('taskId').equals(task.id).count() : 0),
      [task?.id],
    ) ?? 0

  // candidates for "existing task" mode: any live recurring series
  const knownTasks = useLiveQuery(
    async () =>
      (await db.tasks.toArray())
        .filter((t) => !t.archivedAt && t.recurrence.type !== 'none')
        .sort((a, b) => a.title.localeCompare(b.title)),
    [],
  )
  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]))

  const repeats = recType !== 'none'
  const isSeries = task != null && task.recurrence.type !== 'none'
  const logExisting = task == null && mode === 'existing'
  const selectedKnown = knownTasks?.find((t) => t.id === extraTaskId)
  const canSave = logExisting
    ? selectedKnown != null && !occursOn(selectedKnown, extraDate)
    : title.trim().length > 0 && (recType !== 'weekly' || weekdays.length > 0)

  const buildRecurrence = (): Recurrence => {
    switch (recType) {
      case 'none':
        return { type: 'none' }
      case 'daily':
        return { type: 'daily', interval }
      case 'weekly':
        return { type: 'weekly', interval, weekdays }
      case 'monthly':
        return { type: 'monthly', interval, dayOfMonth }
    }
  }

  const buildPayload = () => ({
    title: title.trim(),
    notes: notes.trim(),
    recurrence: buildRecurrence(),
    startDate,
    endDate: repeats && hasEnd ? endDate : undefined,
    timeOfDay: hasTime ? timeOfDay : undefined,
    goalIds,
    color,
    icon,
  })

  const save = async () => {
    if (logExisting) {
      if (!extraTaskId) return
      await addExtraOccurrence(extraTaskId, extraDate)
      onClose()
      return
    }
    if (task && isSeries) {
      // changing a series prompts for scope first
      setScopeAsk('save')
      return
    }
    if (task) await updateTask(task.id, buildPayload())
    else await createTask(buildPayload())
    onClose()
  }

  const applySave = async (scope: 'one' | 'all') => {
    if (!task) return
    if (scope === 'one') {
      // this day becomes its own one-off task carrying the edits
      await splitOccurrence(task.id, defaultDate, {
        title: title.trim(),
        notes: notes.trim(),
        timeOfDay: hasTime ? timeOfDay : undefined,
        goalIds,
        color,
        icon,
      })
    } else {
      await updateTask(task.id, buildPayload())
    }
    onClose()
  }

  const remove = async () => {
    if (!task) return
    if (isSeries) {
      setScopeAsk('delete')
      return
    }
    const ok = await confirmDialog({
      title: `delete “${task.title}”?`,
      confirmLabel: 'delete',
      danger: true,
    })
    if (!ok) return
    await deleteTask(task.id)
    onClose()
  }

  const applyDelete = async (scope: 'one' | 'future' | 'all') => {
    if (!task) return
    if (scope === 'one') await deleteOccurrence(task.id, defaultDate)
    else if (scope === 'future') await endSeriesBefore(task.id, defaultDate)
    else await deleteTask(task.id)
    onClose()
  }

  const toggleWeekday = (i: number) =>
    setWeekdays((w) => (w.includes(i) ? w.filter((d) => d !== i) : [...w, i].sort((a, b) => a - b)))

  const toggleGoal = (id: string) =>
    setGoalIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))

  const intervalUnit =
    recType === 'daily' ? 'day' : recType === 'weekly' ? 'week' : 'month'

  return (
    <Sheet title={task ? 'edit task' : 'new task'} tall onClose={onClose}>
      <div className="space-y-5">
        {!task && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'new', label: 'new task' },
              { value: 'existing', label: 'existing task' },
            ]}
          />
        )}

        {logExisting ? (
          <>
            <Group>
              <Row label="on day">
                <input
                  type="date"
                  value={extraDate}
                  onChange={(e) => e.target.value && setExtraDate(e.target.value)}
                  className="text-right font-semibold text-accent outline-none"
                />
              </Row>
            </Group>

            <section>
              <SectionLabel index="01">pick a task</SectionLabel>
              {knownTasks == null ? null : knownTasks.length > 0 ? (
                <Group>
                  {knownTasks.map((t) => {
                    const alreadyOn = occursOn(t, extraDate)
                    const dotColor = effectiveTaskColor(t, goalMap)
                    const selected = extraTaskId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={alreadyOn}
                        onClick={() => setExtraTaskId(t.id)}
                        className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60 ${
                          alreadyOn ? 'opacity-50' : ''
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full border border-edge/60"
                            style={
                              dotColor
                                ? { background: dotColor }
                                : {
                                    // no color set: a tiny speaker-grille dot
                                    backgroundColor: 'var(--surface2)',
                                    backgroundImage:
                                      'radial-gradient(color-mix(in srgb, var(--ink-dim) 60%, transparent) 1px, transparent 1px)',
                                    backgroundSize: '3px 3px',
                                  }
                            }
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[15px]">
                              {t.icon ? `${t.icon} ` : ''}
                              {t.title}
                            </span>
                            <span className="block text-[11px] text-ink-dim">
                              {alreadyOn
                                ? 'already scheduled on this day'
                                : describeRecurrence(t.recurrence).toLowerCase()}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? 'border-edge bg-accent text-on-accent'
                              : 'border-edge/40 bg-surface2 text-transparent'
                          }`}
                        >
                          <Icon name="check" size={13} strokeWidth={3} />
                        </span>
                      </button>
                    )
                  })}
                </Group>
              ) : (
                <p className="px-2 text-[13px] text-ink-dim">
                  no repeating tasks yet — create one first
                </p>
              )}
            </section>
          </>
        ) : (
          <>
        <Group>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="task name"
            autoFocus={!task}
            className="w-full bg-transparent px-4 py-3 text-[16px] font-semibold outline-none placeholder:text-ink-dim/70"
          />
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="notes"
              rows={2}
              className="w-full resize-none bg-transparent px-4 py-3 pr-11 text-[14px] outline-none placeholder:text-ink-dim/70"
            />
            <button
              type="button"
              aria-label="Expand notes"
              onClick={() => setNotesExpanded(true)}
              className="absolute top-2.5 right-2.5 p-1 text-ink-dim"
            >
              <Icon name="maximize" size={14} />
            </button>
          </div>
        </Group>

        <section>
          <SectionLabel index="01">repeats</SectionLabel>
          <Segmented
            value={recType}
            onChange={setRecType}
            options={[
              { value: 'none', label: 'once' },
              { value: 'daily', label: 'daily' },
              { value: 'weekly', label: 'weekly' },
              { value: 'monthly', label: 'monthly' },
            ]}
          />
          {repeats && (
            <Group className="mt-3">
              <Row label="every">
                <span className="flex items-center gap-2">
                  <NumberField value={interval} onCommit={setIntervalN} min={1} max={365} />
                  <span className="text-ink-dim">
                    {interval === 1 ? intervalUnit : `${intervalUnit}s`}
                  </span>
                </span>
              </Row>
              {recType === 'weekly' && (
                <div className="flex justify-between gap-1.5 px-4 py-3">
                  {WEEKDAY_CHIPS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={`aspect-square max-w-10 flex-1 rounded-[8px] border text-[13px] font-bold transition-colors ${
                        weekdays.includes(i)
                          ? 'border-edge bg-accent text-on-accent'
                          : 'border-edge/40 bg-surface2 text-ink-dim'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {recType === 'monthly' && (
                <Row label="on day">
                  <NumberField value={dayOfMonth} onCommit={setDayOfMonth} min={1} max={31} />
                </Row>
              )}
            </Group>
          )}
        </section>

        <section>
          <SectionLabel index="02">schedule</SectionLabel>
          <Group>
            <Row label={repeats ? 'starts' : 'date'}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => e.target.value && setStartDate(e.target.value)}
                className="text-right font-semibold text-accent outline-none"
              />
            </Row>
            <Row label="time of day">
              <Toggle on={hasTime} onChange={setHasTime} />
            </Row>
            {hasTime && (
              <div className="px-4 py-2.5">
                <TimeSelect value={timeOfDay} onChange={setTimeOfDay} />
              </div>
            )}
            {repeats && (
              <Row label="end repeat">
                <span className="flex items-center gap-3">
                  {hasEnd && (
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => e.target.value && setEndDate(e.target.value)}
                      className="text-right font-semibold text-accent outline-none"
                    />
                  )}
                  <Toggle on={hasEnd} onChange={setHasEnd} />
                </span>
              </Row>
            )}
          </Group>
        </section>

        <section>
          <SectionLabel index="03">appearance</SectionLabel>
          <Group>
            <EmojiPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </Group>
          <p className="mt-1.5 px-1 text-[11px] text-ink-dim">
            no color set = inherits the linked goal's color
          </p>
        </section>

        <section>
          <SectionLabel index="04">linked goals</SectionLabel>
          {goals && goals.length > 0 ? (
            <Group>
              {goals.map((g) => {
                const selected = goalIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors duration-150 active:bg-surface2/60"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full border border-edge/60"
                        style={
                          g.color
                            ? { background: g.color }
                            : {
                                // no color set: a tiny speaker-grille dot
                                backgroundColor: 'var(--surface2)',
                                backgroundImage:
                                  'radial-gradient(color-mix(in srgb, var(--ink-dim) 60%, transparent) 1px, transparent 1px)',
                                backgroundSize: '3px 3px',
                              }
                        }
                      />
                      <span className="truncate text-[15px]">{g.title}</span>
                    </span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        selected
                          ? 'border-edge bg-accent text-on-accent'
                          : 'border-edge/40 bg-surface2 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={13} strokeWidth={3} />
                    </span>
                  </button>
                )
              })}
            </Group>
          ) : (
            <p className="px-2 text-[13px] text-ink-dim">
              create goals in the goals tab, then link tasks to them here
            </p>
          )}
        </section>
          </>
        )}

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="key key-primary w-full py-3.5 text-[15px] font-bold"
          >
            {task ? 'save changes' : logExisting ? 'add occurrence' : 'add task'}
          </button>
          {task && (
            <button
              type="button"
              onClick={() => void remove()}
              className="w-full py-3 text-[14px] font-bold text-danger"
            >
              delete task
            </button>
          )}
        </div>
      </div>

      {notesExpanded &&
        createPortal(
          <div className="h-glass fixed inset-x-0 top-0 z-50 flex flex-col bg-canvas">
            <div className="pt-safe px-5">
              <div className="flex items-center justify-between py-3">
                <h2 className="text-[17px] font-bold tracking-tight">notes</h2>
                <button
                  type="button"
                  onClick={() => setNotesExpanded(false)}
                  className="key px-4 py-1.5 text-[13px] font-bold text-accent"
                >
                  done
                </button>
              </div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="notes"
              autoFocus
              className="module mx-4 mb-4 min-h-0 flex-1 resize-none p-4 text-[15px] leading-relaxed outline-none placeholder:text-ink-dim/70"
            />
            <div style={{ height: keyboardInset }} aria-hidden />
          </div>,
          document.body,
        )}

      {scopeAsk && task && (
        <Sheet
          title={scopeAsk === 'save' ? 'apply changes to…' : 'delete…'}
          onClose={() => setScopeAsk(null)}
        >
          <div className="space-y-2.5">
            {scopeAsk === 'save' ? (
              <>
                <button
                  type="button"
                  onClick={() => void applySave('one')}
                  className="key w-full py-3 text-[14px] font-bold"
                >
                  only this day
                </button>
                <button
                  type="button"
                  onClick={() => void applySave('all')}
                  className="key w-full py-3 text-[14px] font-bold"
                >
                  all events in the series
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void applyDelete('one')}
                  className="key w-full py-3 text-[14px] font-bold"
                >
                  only this day
                </button>
                <button
                  type="button"
                  onClick={() => void applyDelete('future')}
                  className="key w-full py-3 text-[14px] font-bold"
                >
                  this and future events
                  <span className="block text-[11px] font-semibold text-ink-dim">
                    past days and completion history are kept
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void applyDelete('all')}
                  className="key w-full py-3 text-[14px] font-bold text-danger"
                >
                  {completionCount > 0 ? 'entire series + history' : 'entire series'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setScopeAsk(null)}
              className="w-full py-2.5 text-[14px] font-bold text-ink-dim"
            >
              cancel
            </button>
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}
