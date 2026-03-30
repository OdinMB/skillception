interface Segment {
  value: number
  color: string
  name: string
}

interface Row {
  label: string
  segments: Segment[]
}

interface Props {
  rows: Row[]
  maxValue?: number
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export default function TokenChart({ rows, maxValue }: Props) {
  const max =
    maxValue ??
    Math.max(
      ...rows.map((r) => r.segments.reduce((s, seg) => s + seg.value, 0)),
      1,
    )

  // Collect unique segment names for the legend (preserve order)
  const legendItems: { name: string; color: string }[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const seg of row.segments) {
      if (!seen.has(seg.name)) {
        seen.add(seg.name)
        legendItems.push({ name: seg.name, color: seg.color })
      }
    }
  }

  return (
    <div className="token-chart">
      {rows.map((row) => {
        const total = row.segments.reduce((s, seg) => s + seg.value, 0)
        return (
          <div className="token-row" key={row.label}>
            <div className="token-label">{row.label}</div>
            <div className="token-track">
              {row.segments.map((seg) =>
                seg.value > 0 ? (
                  <div
                    key={seg.name}
                    className="token-segment"
                    style={{
                      width: `${(seg.value / max) * 100}%`,
                      background: seg.color,
                    }}
                    title={`${seg.name}: ${formatTokens(seg.value)}`}
                  />
                ) : null,
              )}
            </div>
            <div className="token-total">{formatTokens(total)}</div>
          </div>
        )
      })}
      <div className="token-legend">
        {legendItems.map((item) => (
          <span className="token-legend-item" key={item.name}>
            <span
              className="token-legend-swatch"
              style={{ background: item.color }}
            />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  )
}
