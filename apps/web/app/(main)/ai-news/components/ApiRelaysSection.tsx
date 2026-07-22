'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ExternalLink, Zap, Building2, User, AlertTriangle, Lightbulb, Search } from 'lucide-react'
import { COMPANY_RELAYS, PERSONAL_RELAY_NOTE } from './api-relays'
import { encodePrefill } from './vendor-platforms'

/** 从所有公司平台中提取去重后的厂商列表 */
function useUniqueVendors(): string[] {
  return React.useMemo(() => {
    const set = new Set<string>()
    COMPANY_RELAYS.forEach((r) => r.vendors.forEach((v) => set.add(v)))
    return Array.from(set).sort()
  }, [])
}

/** 计费模式分类(从 billing 自由文本提取) */
type BillingMode = 'token' | 'gpu' | 'free' | 'subscription'

const BILLING_FILTERS: Array<{ key: BillingMode | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'allBilling' },
  { key: 'token', labelKey: 'billingToken' },
  { key: 'free', labelKey: 'billingFree' },
  { key: 'gpu', labelKey: 'billingGpu' },
  { key: 'subscription', labelKey: 'billingSubscription' },
]

/** 判断一个平台的计费模式是否匹配筛选 */
function matchBillingMode(billing: string, mode: BillingMode): boolean {
  const s = billing.toLowerCase()
  switch (mode) {
    case 'token': return s.includes('按 token') || s.includes('按token') || s.includes('per token')
    case 'gpu': return s.includes('gpu') || s.includes('按秒') || s.includes('算力')
    case 'free': return s.includes('免费') || s.includes('free')
    case 'subscription': return s.includes('套餐') || s.includes('包月') || s.includes('包年')
  }
}

/** API 中转站区块:公司平台 + 个人运行说明 */
export function ApiRelaysSection() {
  const router = useRouter()
  const t = useTranslations('aiNews.apiRelays')

  const [query, setQuery] = React.useState('')
  const [activeVendor, setActiveVendor] = React.useState<string | null>(null)
  const [activeBilling, setActiveBilling] = React.useState<BillingMode | 'all'>('all')
  const allVendors = useUniqueVendors()

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return COMPANY_RELAYS.filter((r) => {
      if (q) {
        const hit =
          r.name.toLowerCase().includes(q) ||
          r.features.toLowerCase().includes(q) ||
          r.billing.toLowerCase().includes(q) ||
          r.vendors.some((v) => v.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (activeVendor && !r.vendors.includes(activeVendor)) return false
      if (activeBilling !== 'all' && !matchBillingMode(r.billing, activeBilling)) return false
      return true
    })
  }, [query, activeVendor, activeBilling])

  function handleRelayImport(baseUrl: string, name: string) {
    const payload = encodePrefill({
      providerCode: 'openai',
      name: `${name} 中转`,
      baseUrlOverride: baseUrl,
      apiFormat: 'openai_chat',
    })
    router.push(`/settings/llm?prefill=${payload}`)
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="px-5 py-4">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-4 px-5 pb-5">
        {/* 公司平台性质 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-xs font-semibold">{t('companyType')}</h3>
          </div>

          {/* 搜索 + 厂商筛选 */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-md border border-input bg-background py-1.5 pl-7 pr-7 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setActiveVendor(null)}
                className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  activeVendor === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {t('allVendors')}
              </button>
              {allVendors.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setActiveVendor((cur) => (cur === v ? null : v))}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    activeVendor === v
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            {/* 计费模式筛选 */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-muted-foreground/70">{t('billingLabel')}:</span>
              {BILLING_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveBilling((cur) => (cur === f.key ? 'all' : f.key))}
                  className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                    activeBilling === f.key
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {t('resultCount', { count: filtered.length, total: COMPANY_RELAYS.length })}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.length === 0 ? (
              <div className="col-span-full rounded-lg border border-dashed bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                {t('emptyResult')}
              </div>
            ) : null}
            {filtered.map((relay) => (
              <div
                key={relay.name}
                className="rounded-lg border bg-background p-3 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{relay.name}</span>
                      <a
                        href={relay.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {relay.features}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {relay.vendors.slice(0, 4).map((v) => (
                        <span
                          key={v}
                          className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground"
                        >
                          {v}
                        </span>
                      ))}
                      {relay.vendors.length > 4 ? (
                        <span className="text-[9px] text-muted-foreground">
                          +{relay.vendors.length - 4}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-muted-foreground/80">{relay.billing}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRelayImport(relay.baseUrl, relay.name)}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    <Zap className="h-2.5 w-2.5" />
                    <span>{t('import')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 个人运行性质 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold">{t('personalType')}</h3>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="space-y-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-amber-600">{t('riskTitle')}</p>
                  <ul className="space-y-0.5">
                    {PERSONAL_RELAY_NOTE.risks.map((risk) => (
                      <li key={risk} className="text-[10px] leading-relaxed text-muted-foreground">
                        · {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-primary">{t('tipsTitle')}</p>
                  <ul className="space-y-0.5">
                    {PERSONAL_RELAY_NOTE.tips.map((tip) => (
                      <li key={tip} className="text-[10px] leading-relaxed text-muted-foreground">
                        · {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
