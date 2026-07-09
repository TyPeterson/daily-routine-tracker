import { useState } from 'react'
import { getDate, getDay } from 'date-fns'
import { Icon } from '../../components/Icon'
import { NumberField } from '../../components/NumberField'
import { Sheet } from '../../components/Sheet'
import { TimeSelect } from '../../components/TimeSelect'
import { Group, Row, SectionLabel, Segmented, Toggle } from '../../components/forms'
import { ColorPicker, EmojiPicker } from '../../components/pickers'
import { createTask, deleteTask, updateTask } from '../../db/repo'
import type { Task } from '../../db/models'
import { addDaysStr, fromDateStr, type DateStr } from '../../domain/dates'
import type { Recurrence } from '../../domain/recurrence'
import { useActiveGoals } from '../../hooks/useGoals'

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

  const repeats = recType !== 'none'
  const canSave = title.trim().length > 0 && (recType !== 'weekly' || weekdays.length > 0)

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

  const save = async () => {
    const payload = {
      title: title.trim(),
      notes: notes.trim(),
      recurrence: buildRecurrence(),
      startDate,
      endDate: repeats && hasEnd ? endDate : undefined,
      timeOfDay: hasTime ? timeOfDay : undefined,
      goalIds,
      color,
      icon,
    }
    if (task) await updateTask(task.id, payload)
    else await createTask(payload)
    onClose()
  }

  const remove = async () => {
    if (!task) return
    if (!window.confirm(`Delete “${task.title}” and its completion history?`)) return
    await deleteTask(task.id)
    onClose()
  }

  const toggleWeekday = (i: number) =>
    setWeekdays((w) => (w.includes(i) ? w.filter((d) => d !== i) : [...w, i].sort((a, b) => a - b)))

  const toggleGoal = (id: string) =>
    setGoalIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))

  const intervalUnit =
    recType === 'daily' ? 'day' : recType === 'weekly' ? 'week' : 'month'

  return (
    <Sheet title={task ? 'Edit Task' : 'New Task'} onClose={onClose}>
      <div className="space-y-5">
        <Group>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task name"
            autoFocus={!task}
            className="w-full bg-transparent px-4 py-3 text-[17px] font-medium outline-none placeholder:text-ink-dim/70"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            className="w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-ink-dim/70"
          />
        </Group>

        <section>
          <SectionLabel>Repeats</SectionLabel>
          <Segmented
            value={recType}
            onChange={setRecType}
            options={[
              { value: 'none', label: 'Once' },
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
            ]}
          />
          {repeats && (
            <Group className="mt-3">
              <Row label="Every">
                <span className="flex items-center gap-2">
                  <NumberField value={interval} onCommit={setIntervalN} min={1} max={365} />
                  <span className="text-ink-dim">
                    {interval === 1 ? intervalUnit : `${intervalUnit}s`}
                  </span>
                </span>
              </Row>
              {recType === 'weekly' && (
                <div className="flex justify-between px-4 py-3">
                  {WEEKDAY_CHIPS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className={`h-10 w-10 rounded-full text-[14px] font-semibold transition-colors ${
                        weekdays.includes(i) ? 'bg-accent text-white' : 'bg-surface2 text-ink-dim'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {recType === 'monthly' && (
                <Row label="On day">
                  <NumberField value={dayOfMonth} onCommit={setDayOfMonth} min={1} max={31} />
                </Row>
              )}
            </Group>
          )}
        </section>

        <section>
          <SectionLabel>Schedule</SectionLabel>
          <Group>
            <Row label={repeats ? 'Starts' : 'Date'}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => e.target.value && setStartDate(e.target.value)}
                className="text-right font-medium text-accent outline-none"
              />
            </Row>
            <Row label="Time of day">
              <span className="flex items-center gap-3">
                {hasTime && <TimeSelect value={timeOfDay} onChange={setTimeOfDay} />}
                <Toggle on={hasTime} onChange={setHasTime} />
              </span>
            </Row>
            {repeats && (
              <Row label="End repeat">
                <span className="flex items-center gap-3">
                  {hasEnd && (
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => e.target.value && setEndDate(e.target.value)}
                      className="text-right font-medium text-accent outline-none"
                    />
                  )}
                  <Toggle on={hasEnd} onChange={setHasEnd} />
                </span>
              </Row>
            )}
          </Group>
        </section>

        <section>
          <SectionLabel>Appearance</SectionLabel>
          <Group>
            <EmojiPicker value={icon} onChange={setIcon} />
            <ColorPicker value={color} onChange={setColor} />
          </Group>
        </section>

        <section>
          <SectionLabel>Linked goals</SectionLabel>
          {goals && goals.length > 0 ? (
            <Group>
              {goals.map((g) => {
                const selected = goalIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGoal(g.id)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left"
                  >
                    <span className="text-[16px]">{g.title}</span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        selected ? 'bg-accent text-white' : 'bg-surface2 text-transparent'
                      }`}
                    >
                      <Icon name="check" size={14} strokeWidth={3} />
                    </span>
                  </button>
                )
              })}
            </Group>
          ) : (
            <p className="px-2 text-[14px] text-ink-dim">
              Create goals in the Goals tab, then link tasks to them here.
            </p>
          )}
        </section>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void save()}
            className="w-full rounded-2xl bg-accent py-3.5 text-[16px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {task ? 'Save Changes' : 'Add Task'}
          </button>
          {task && (
            <button
              type="button"
              onClick={() => void remove()}
              className="w-full rounded-2xl py-3 text-[15px] font-medium text-danger"
            >
              Delete Task
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
