function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

/** 命中率柱状图(纯 SVG) */
function HitsBarChart({ hits7d, hits30d }: { hits7d: number; hits30d: number }) {
  const maxVal = Math.max(hits7d, hits30d, 1)
  const barH = (v: number) => (v / maxVal) * 50
  return (
    <svg viewBox="0 0 120 64" className="h-16 w-full">
      <rect
        x="10"
        y={60 - barH(hits30d)}
        width="30"
        height={barH(hits30d)}
        rx="2"
        className="fill-foreground/20"
      />
      <rect
        x="60"
        y={60 - barH(hits7d)}
        width="30"
        height={barH(hits7d)}
        rx="2"
        className="fill-green-500/40"
      />
      <text x="25" y="62" textAnchor="middle" className="fill-muted-foreground text-[8px]">
        30天
      </text>
      <text x="75" y="62" textAnchor="middle" className="fill-muted-foreground text-[8px]">
        7天
      </text>
      <text
        x="25"
        y={56 - barH(hits30d)}
        textAnchor="middle"
        className="fill-muted-foreground text-[8px]"
      >
        {hits30d}
      </text>
      <text
        x="75"
        y={56 - barH(hits7d)}
        textAnchor="middle"
        className="fill-muted-foreground text-[8px]"
      >
        {hits7d}
      </text>
    </svg>
  )
}

/** 满意度饼图(纯 SVG) */
function SatisfactionPie({ positive, total }: { positive: number; total: number }) {
  const negative = total - positive
  const radius = 20
  const circumference = 2 * Math.PI * radius
  const positiveRatio = total > 0 ? positive / total : 0
  const positiveArc = circumference * positiveRatio

  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 48 48" className="h-12 w-12">
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="fill-none stroke-red-500/30"
          strokeWidth="6"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="fill-none stroke-green-500/50 transition-all"
          strokeWidth="6"
          strokeDasharray={`${positiveArc} ${circumference}`}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="space-y-0.5 text-[10px]">
        <p className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-green-500/50" />
          正面 {positive}
        </p>
        <p className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/30" />
          负面 {negative}
        </p>
        <p className="text-muted-foreground">共 {total} 条</p>
      </div>
    </div>
  )
}

export { StatCard, HitsBarChart, SatisfactionPie }
