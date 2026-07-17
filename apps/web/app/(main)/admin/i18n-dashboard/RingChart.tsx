export function RingChart({ value, color }: { value: number; color: string }) {
  const deg = (value / 100) * 360
  return (
    <div
      className="relative flex h-20 w-20 items-center justify-center rounded-2xl"
      style={{ background: `conic-gradient(${color} ${deg}deg, hsl(var(--muted)) 0deg)` }}
    >
      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-background">
        <span className="text-sm font-bold">{value}%</span>
      </div>
    </div>
  )
}
