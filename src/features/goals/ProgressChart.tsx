import { format } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CheckIn, Checkpoint, GoalMetric } from '../../db/models'
import { useCssVar } from '../../hooks/useCssVar'

/**
 * Check-in values over time with the target and checkpoint values drawn as
 * reference lines — the "am I trending the right way" view.
 */
export function ProgressChart({
  checkIns,
  metric,
  checkpoints,
}: {
  checkIns: CheckIn[] // ascending by `at`, all with values
  metric?: GoalMetric
  checkpoints: Checkpoint[]
}) {
  const accent = useCssVar('--accent')
  const good = useCssVar('--good')
  const inkDim = useCssVar('--ink-dim')
  const line = useCssVar('--line')
  const surface = useCssVar('--surface')

  const data = checkIns.map((c) => ({ at: c.at, value: c.value! }))
  const markedCheckpoints = checkpoints.filter((c) => c.targetValue != null)

  const allValues = [
    ...data.map((d) => d.value),
    ...(metric?.targetValue != null ? [metric.targetValue] : []),
    ...markedCheckpoints.map((c) => c.targetValue!),
  ]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const pad = (max - min || Math.abs(max) || 1) * 0.15

  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -14 }}>
        <CartesianGrid stroke={line} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="at"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => format(v, 'MMM d')}
          tick={{ fontSize: 11, fill: inkDim }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tick={{ fontSize: 11, fill: inkDim }}
          tickFormatter={(v: number) => `${Math.round(v * 100) / 100}`}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          labelFormatter={(v) => format(Number(v), 'MMM d, yyyy')}
          formatter={(v) => [`${v}${metric ? ` ${metric.unit}` : ''}`, 'Check-in']}
          contentStyle={{
            background: surface,
            border: 'none',
            borderRadius: 12,
            fontSize: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        />
        {metric?.targetValue != null && (
          <ReferenceLine
            y={metric.targetValue}
            stroke={good}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: 'Target', fontSize: 10, fill: good, position: 'insideTopRight' }}
          />
        )}
        {markedCheckpoints.map((cp) => (
          <ReferenceLine
            key={cp.id}
            y={cp.targetValue!}
            stroke={inkDim}
            strokeDasharray="2 5"
            label={{ value: cp.title, fontSize: 9, fill: inkDim, position: 'insideTopLeft' }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={2.5}
          dot={{ r: 3.5, fill: accent, strokeWidth: 0 }}
          activeDot={{ r: 5.5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
