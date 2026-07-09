/**
 * Land-count distribution histogram. Single series → no legend; bars in the
 * keepable range use the accent, the rest the soft step (keyed in the title
 * line, not by color alone — the x-axis states the land count).
 */
export default function Histogram({
  distribution,
  keepableMin,
  keepableMax,
}: {
  distribution: number[];
  keepableMin: number;
  keepableMax: number;
}) {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const max = Math.max(...distribution);
  const slot = 44;
  const barWidth = 22;
  const plotHeight = 120;
  const topPad = 20; // cap labels
  const bottomPad = 34; // x labels + axis title
  const width = distribution.length * slot;
  const height = topPad + plotHeight + bottomPad;

  return (
    <div className="histogram-wrap">
      <p className="histogram-title">
        Lands in hand across {total.toLocaleString()} hands — solid bars are the
        keepable range ({keepableMin}–{keepableMax})
      </p>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Histogram of land counts per hand"
      >
        {distribution.map((count, lands) => {
          const h = max ? Math.round((count / max) * plotHeight) : 0;
          const x = lands * slot + (slot - barWidth) / 2;
          const y = topPad + plotHeight - h;
          const keepable = lands >= keepableMin && lands <= keepableMax;
          const pct = total ? (count / total) * 100 : 0;
          const r = Math.min(4, h); // rounded cap, square baseline
          const path =
            h > 0
              ? `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${
                  x + barWidth - r
                } Q ${x + barWidth} ${y} ${x + barWidth} ${y + r} V ${y + h} Z`
              : '';
          return (
            <g key={lands} className="histo-bar">
              <title>{`${lands} lands: ${count.toLocaleString()} hands (${pct.toFixed(1)}%)`}</title>
              {/* invisible full-slot hit target for hover */}
              <rect
                x={lands * slot}
                y={0}
                width={slot}
                height={height}
                fill="transparent"
              />
              {h > 0 && (
                <path d={path} fill={keepable ? 'var(--accent)' : 'var(--accent-soft)'} />
              )}
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-2)"
              >
                {pct >= 0.05 ? `${pct < 9.95 ? pct.toFixed(1) : Math.round(pct)}%` : ''}
              </text>
              <text
                x={x + barWidth / 2}
                y={topPad + plotHeight + 15}
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-muted)"
              >
                {lands}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          y1={topPad + plotHeight}
          x2={width}
          y2={topPad + plotHeight}
          stroke="var(--axis)"
          strokeWidth="1"
        />
        <text
          x={width / 2}
          y={height - 4}
          textAnchor="middle"
          fontSize="11"
          fill="var(--ink-muted)"
        >
          Lands in opening hand
        </text>
      </svg>
    </div>
  );
}
