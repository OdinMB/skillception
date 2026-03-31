import { useState, useSyncExternalStore } from 'react'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const noop = () => () => {}
function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false)
}

interface Props {
  data: { round: number; [label: string]: number }[]
  labels: string[]
  colors: string[]
}

function CustomLegend({
  labels,
  colors,
  active,
  onHover,
  onClick,
}: {
  labels: string[]
  colors: string[]
  active: string | null
  onHover: (label: string | null) => void
  onClick: (label: string) => void
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '1.5em',
      fontFamily: 'var(--font-serif, Georgia, serif)',
      fontSize: 13,
      marginBottom: 4,
    }}>
      {labels.map((label, i) => {
        const subdued = active !== null && active !== label
        return (
          <span
            key={label}
            role="button"
            tabIndex={0}
            onMouseEnter={() => onHover(label)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(label)}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(label) }}
            style={{
              cursor: 'pointer',
              opacity: subdued ? 0.35 : 1,
              transition: 'opacity 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4em',
              borderBottom: '1px dashed var(--color-rule)',
              paddingBottom: 1,
            }}
          >
            <span style={{
              display: 'inline-block',
              width: 12,
              height: 12,
              background: colors[i],
              borderRadius: 2,
            }} />
            {label}
          </span>
        )
      })}
    </div>
  )
}

export default function RoundDistributionChart({ data, labels, colors }: Props) {
  const hydrated = useHydrated()
  const [hovered, setHovered] = useState<string | null>(null)
  const [locked, setLocked] = useState<string | null>(labels[0] ?? null)

  const active = locked ?? hovered

  function handleClick(label: string) {
    setLocked((prev) => (prev === label ? null : label))
  }

  if (!hydrated) {
    return <div style={{ height: 340 }} />
  }

  return (
    <div>
      <CustomLegend
        labels={labels}
        colors={colors}
        active={active}
        onHover={setHovered}
        onClick={handleClick}
      />
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" />
          <XAxis
            dataKey="round"
            tickFormatter={(r: number) => `${r}`}
            tick={{ fontSize: 13, fontFamily: 'var(--font-serif, Georgia, serif)' }}
            stroke="var(--color-ink)"
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 13, fontFamily: 'var(--font-serif, Georgia, serif)' }}
            stroke="var(--color-ink)"
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [`${value}%`, `${name}`]}
            labelFormatter={(round: unknown) => `Round ${round}`}
            contentStyle={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 13,
              background: 'var(--color-paper)',
              border: '1px solid var(--color-rule)',
            }}
          />
          {labels.map((label, i) => (
            <Area
              key={`area-${label}`}
              dataKey={label}
              type="monotone"
              stroke="none"
              fill={colors[i]}
              fillOpacity={active === label ? 0.18 : 0}
              legendType="none"
              tooltipType="none"
              isAnimationActive={false}
            />
          ))}
          {labels.map((label, i) => (
            <Bar
              key={label}
              dataKey={label}
              fill={colors[i]}
              fillOpacity={active === null || active === label ? 1 : 0.2}
              maxBarSize={40}
              legendType="none"
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
