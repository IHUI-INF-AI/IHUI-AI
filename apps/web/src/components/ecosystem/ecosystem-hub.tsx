// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:web 端生态统一入口聚合页(D17),依赖 next/link 与 next-intl,不适合共享层
'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Boxes, Library, Rocket, Sparkles, Store, Wand2, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 五个并列市场入口(D17:由顶栏分散收敛到本页分组导航) */
type MarketKey = 'aiSkills' | 'mcpStore' | 'capabilityMarket' | 'skillsMarket' | 'connectors'

const MARKETS: Record<MarketKey, { href: string; icon: LucideIcon }> = {
  aiSkills: { href: '/ai-skills', icon: Sparkles },
  mcpStore: { href: '/mcp-store', icon: Store },
  capabilityMarket: { href: '/capability-market', icon: Boxes },
  skillsMarket: { href: '/skills-market', icon: Wand2 },
  connectors: { href: '/connectors', icon: Library },
}

const MARKET_ORDER: MarketKey[] = [
  'aiSkills',
  'mcpStore',
  'capabilityMarket',
  'skillsMarket',
  'connectors',
]

/** 专家包 = 跨多个既有市场的能力组合(纯导航聚合,不新增数据实体) */
const BUNDLES: Record<
  'contentCreator' | 'developerExtension',
  { icon: LucideIcon; includes: MarketKey[] }
> = {
  contentCreator: { icon: Rocket, includes: ['aiSkills', 'skillsMarket', 'connectors'] },
  developerExtension: { icon: Wrench, includes: ['mcpStore', 'capabilityMarket'] },
}

const BUNDLE_ORDER = Object.keys(BUNDLES) as (keyof typeof BUNDLES)[]

export function EcosystemHub() {
  const t = useTranslations('ecosystem')

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('description')}</p>
      </header>

      <section aria-labelledby="ecosystem-markets">
        <h2 id="ecosystem-markets" className="mb-2 text-sm font-medium">
          {t('marketsSection')}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET_ORDER.map((key) => {
            const market = MARKETS[key]
            const Icon = market.icon
            return (
              <Link
                key={key}
                href={market.href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(`cards.${key}.title`)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {t(`cards.${key}.desc`)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="ecosystem-bundles" className="mt-8">
        <h2 id="ecosystem-bundles" className="text-sm font-medium">
          {t('bundlesSection')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('bundlesHint')}</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BUNDLE_ORDER.map((key) => {
            const bundle = BUNDLES[key]
            const Icon = bundle.icon
            return (
              <div key={key} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">{t(`bundles.${key}.title`)}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`bundles.${key}.desc`)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bundle.includes.map((marketKey) => (
                    <Link
                      key={marketKey}
                      href={MARKETS[marketKey].href}
                      className="rounded-md bg-muted px-2 py-1 text-xs transition-colors hover:bg-accent"
                    >
                      {t(`cards.${marketKey}.title`)}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
