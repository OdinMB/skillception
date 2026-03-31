import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface Props {
  data: { round: number; [label: string]: number }[]
  labels: string[]
  colors: string[]
}

export default function RoundDistributionChart({ data, labels, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
        <Legend
          wrapperStyle={{
            fontFamily: 'var(--font-serif, Georgia, serif)',
            fontSize: 13,
          }}
        />
        {labels.map((label, i) => (
          <Bar
            key={label}
            dataKey={label}
            fill={colors[i]}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
