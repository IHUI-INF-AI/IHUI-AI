const STATS = [
  { value: '10万+', label: '注册用户' },
  { value: '1000+', label: '精品课程' },
  { value: '百万级', label: 'AI 月调用量' },
  { value: '99%', label: '用户满意度' },
]

export function StatsSection() {
  return (
    <section className="border-y bg-muted/30 py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
