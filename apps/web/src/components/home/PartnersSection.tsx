const PARTNERS = ['云智科技', '数据先锋', '智链教育', '创新工场', '星辰互联', '远景智能']

export function PartnersSection() {
  return (
    <section className="py-16">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          受到众多知名企业信赖
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PARTNERS.map((p) => (
            <div
              key={p}
              className="flex h-16 items-center justify-center rounded-lg border bg-card text-sm font-medium text-muted-foreground grayscale transition-all hover:grayscale-0 hover:text-foreground"
            >
              {p}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
