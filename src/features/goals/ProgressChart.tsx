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
import { chartScale } from '../../domain/chartScale'
import { useCssVar } from '../../hooks/useCssVar'

/**
 * Check-in values over time with the target and checkpoint values drawn as
 * reference lines — the "am I trending the right way" view.
 */
export function ProgressChart({
  checkIns,
  metric,
  checkpoints,
  color,
}: {
  checkIns: CheckIn[] // ascending by `at`, all with values
  metric?: GoalMetric
  checkpoints: Checkpoint[]
  /** the goal's color; series color follows the entity */
  color?: string
}) {
  const accent = useCssVar('--accent')
  const good = useCssVar('--good')
  const inkDim = useCssVar('--ink-dim')
  const line = useCssVar('--line')
  const surface = useCssVar('--surface')
  const seriesColor = color ?? accent
  const checkpointLabel = (cp: Checkpoint) => cp.title ?? String(cp.targetValue)

  const data = checkIns.map((c) => ({ at: c.at, value: c.value! }))
  const markedCheckpoints = checkpoints.filter((c) => c.targetValue != null)

  // axis runs start → target, stretching only when data crosses a bound
  const { domain, ticks } = chartScale([
    ...(metric?.startValue != null ? [metric.startValue] : []),
    ...(metric?.targetValue != null ? [metric.targetValue] : []),
    ...markedCheckpoints.map((c) => c.targetValue!),
    ...data.map((d) => d.value),
  ])

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
          domain={domain}
          ticks={ticks}
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
            label={{ value: 'target', fontSize: 10, fill: inkDim, position: 'insideTopRight' }}
          />
        )}
        {markedCheckpoints.map((cp) => (
          <ReferenceLine
            key={cp.id}
            y={cp.targetValue!}
            stroke={cp.achievedAt != null ? good : inkDim}
            strokeOpacity={cp.achievedAt != null ? 0.7 : 1}
            strokeDasharray="2 5"
            label={{
              value: checkpointLabel(cp),
              fontSize: 9,
              fill: inkDim,
              position: 'insideTopLeft',
            }}
          />
        ))}
        <Line
          type="monotone"
          dataKey="value"
          stroke={seriesColor}
          strokeWidth={2}
          dot={{ r: 4, fill: seriesColor, strokeWidth: 2, stroke: surface }}
          activeDot={{ r: 6 }}
          isAnimationActive
          animationDuration={550}
          animationEasing="ease-out"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
