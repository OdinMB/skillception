import { useState, useEffect } from "react";

/** Inline SVG diagram showing how rounds work: ascent then descent. */
export default function RoundDiagram() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 600px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const allRounds = [
    { label: "Round 1", peak: 2, steps: 2 },
    { label: "Round 2", peak: 3, steps: 3 },
    { label: "Round 3", peak: 4, steps: 4 },
  ];

  // On mobile, show only rounds 2+3 to save space
  const rounds = isMobile ? allRounds.slice(1) : allRounds;
  const showConnectFrom = isMobile ? 0 : 0; // connect between all visible rounds

  const colW = isMobile ? 140 : 160;
  const rowH = 32;
  const padLeft = 40;
  const padTop = 30;
  const levels = 4;

  const w = padLeft + rounds.length * colW + 20;
  const h = padTop + levels * rowH + 28;

  const levelY = (level: number) => padTop + (levels - level) * rowH;

  const accentColor = "var(--color-accent, #8b1a1a)";
  const verifyColor = "var(--color-blue, #2563eb)";
  const textColor = "var(--color-ink, #1a1a1a)";
  const mutedColor = "var(--color-caption, #666)";
  const connectColor = "var(--color-caption, #999)";

  const roundX = (ri: number) => padLeft + ri * colW + colW / 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ width: "100%", maxWidth: 560, display: "block", margin: "0 auto" }}
      role="img"
      aria-label="Diagram showing how each round ascends to a new peak level then descends back to level 1"
    >
      {/* Level labels on left */}
      {Array.from({ length: levels }, (_, i) => i + 1).map((level) => (
        <text
          key={level}
          x={padLeft - 10}
          y={levelY(level) + 5}
          textAnchor="end"
          fontSize="12"
          fontFamily="var(--font-sans)"
          fill={mutedColor}
        >
          L{level}
        </text>
      ))}

      {/* Horizontal grid lines */}
      {Array.from({ length: levels }, (_, i) => i + 1).map((level) => (
        <line
          key={level}
          x1={padLeft}
          y1={levelY(level)}
          x2={w - 20}
          y2={levelY(level)}
          stroke={mutedColor}
          strokeOpacity={0.15}
          strokeDasharray="4 4"
        />
      ))}

      {/* Connecting lines between rounds */}
      {rounds.slice(showConnectFrom, -1).map((_, ri) => {
        const fromX = roundX(ri) + 20;
        const toX = roundX(ri + 1) - 20;
        const y = levelY(1);
        return (
          <line
            key={`connect-${ri}`}
            x1={fromX}
            y1={y}
            x2={toX}
            y2={y}
            stroke={connectColor}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        );
      })}

      {/* Each round */}
      {rounds.map((round, ri) => {
        const cx = roundX(ri);
        const baseY = levelY(1);
        const peakY = levelY(round.peak);
        const ascentX = cx - 20;
        const descentX = cx + 20;
        const path = `M ${ascentX} ${baseY} L ${ascentX} ${peakY} L ${descentX} ${peakY} L ${descentX} ${baseY}`;

        return (
          <g key={ri}>
            {/* Round label */}
            <text
              x={cx}
              y={padTop - 12}
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fontFamily="var(--font-sans)"
              fill={textColor}
            >
              {round.label}
            </text>

            {/* The arch path */}
            <path
              d={path}
              fill="none"
              stroke={textColor}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />

            {/* Ascent arrow tip */}
            <polygon
              points={`${ascentX} ${peakY}, ${ascentX - 4} ${peakY + 8}, ${ascentX + 4} ${peakY + 8}`}
              fill={accentColor}
            />

            {/* Descent arrow tip */}
            <polygon
              points={`${descentX} ${baseY}, ${descentX - 4} ${baseY - 8}, ${descentX + 4} ${baseY - 8}`}
              fill={verifyColor}
            />

            {/* "ascend" label on ascent */}
            <text
              x={ascentX - 6}
              y={(baseY + peakY) / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--font-sans)"
              fill={accentColor}
            >
              ascend
            </text>

            {/* "descend" label on descent */}
            <text
              x={descentX + 6}
              y={(baseY + peakY) / 2 + 4}
              textAnchor="start"
              fontSize="10"
              fontFamily="var(--font-sans)"
              fill={verifyColor}
            >
              descend
            </text>

            {/* Dots: ascent has only base + peak, descent has all levels */}
            <circle cx={ascentX} cy={baseY} r={3} fill={accentColor} />
            <circle cx={ascentX} cy={peakY} r={3} fill={accentColor} />
            {Array.from({ length: round.peak }, (_, i) => i + 1).map((level) => (
              <circle key={level} cx={descentX} cy={levelY(level)} r={3} fill={verifyColor} />
            ))}

            {/* Step count below */}
            <text
              x={cx}
              y={baseY + 24}
              textAnchor="middle"
              fontSize="10"
              fontFamily="var(--font-sans)"
              fill={mutedColor}
            >
              {round.steps} steps
            </text>
          </g>
        );
      })}
    </svg>
  );
}
