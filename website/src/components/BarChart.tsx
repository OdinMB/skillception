interface Bar {
  label: string
  value: number
  display?: string
  color?: 'red' | 'blue' | 'green'
}

interface Props {
  bars: Bar[]
  maxValue?: number
}

export default function BarChart({ bars, maxValue }: Props) {
  const max = maxValue ?? bars.map((b) => b.value).reduce((a, b) => Math.max(a, b), 1)
  return (
    <div className="bar-chart">
      {bars.map((bar) => (
        <div className="bar-row" key={bar.label}>
          <div className="bar-label">{bar.label}</div>
          <div className="bar-track">
            <div
              className={`bar-fill ${bar.color === 'blue' ? 'accent' : bar.color === 'green' ? 'green' : ''}`}
              style={{ width: `${(bar.value / max) * 100}%` }}
            />
          </div>
          <div className="bar-value">{bar.display ?? bar.value}</div>
        </div>
      ))}
    </div>
  )
}
