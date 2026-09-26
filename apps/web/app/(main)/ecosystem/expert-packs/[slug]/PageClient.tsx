// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:D17 专家包详情页,依赖 next/link + next/navigation 与 next-intl,不适合共享层

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { ViewMoreLink } from '@/components/common/view-more-link'
import { CountBadge } from '@/components/ecosystem/count-badge'
import {
  MARKETS,
  aiSkillDetailHref,
  connectorAuthDetailHref,
  ecosystemHubHref,
  expertPackListHref,
  findExpertPack,
  skillDetailHref,
  type MarketKey,
} from '@/components/ecosystem/expert-packs'
import { useEcosystemOverview, type EcosystemOverview } from '@/components/ecosystem/use-ecosystem-overview'

interface SampleLink {
  href: string
  label: string
}

/**
 * 该市场此刻可直达的一个真实条目。
 *
 * 只有**列表数据里真有这一条**才给深链;没有详情页的市场(mcpStore / capabilityMarket)
 * 一律返回 undefined —— 入口只留列表页链接,绝不拼一个 404 地址。
 */
function sampleLink(marketKey: MarketKey, overview: EcosystemOverview): SampleLink | undefined {
  if (marketKey === 'skillsMarket') {
    const first = overview.skills.items[0]
    return first ? { href: skillDetailHref(first.name), label: first.name } : undefined
  }
  if (marketKey === 'aiSkills') {
    const first = overview.aiSkills.items[0]
    return first ? { href: aiSkillDetailHref(first.id), label: first.name } : undefined
  }
  if (marketKey === 'connectors') {
    const first = overview.connectors.entries[0]
    return first ? { href: connectorAuthDetailHref(first.key), label: first.name } : undefined
  }
  return undefined
}

export default function ExpertPackDetailPageClient() {
  const t = useTranslations('ecosystem')
  const more = useTranslations('common')
  const params = useParams<{ slug?: string | string[] }>()
  const raw = Array.isArray(params.slug) ? params.slug[0] : params.slug
  // 动态段一般已解码,但畸形百分号编码(手改地址栏)不得崩掉整页 ⇒ 兜底回原值
  let slug = raw ?? ''
  try {
    slug = decodeURIComponent(slug)
  } catch {
    /* 保持原值 */
  }

  const pack = findExpertPack(slug)

  // 取数钩子必须在任何早退之前调用(hooks 顺序不可分支,否则真机上会随机错位)
  const overview = useEcosystemOverview()

  if (!pack) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('packNotFound')}</p>
        <Link
          href={expertPackListHref()}
          className="mt-3 inline-flex items-center rounded-md bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-accent"
        >
          <span>{t('packsListLink')}</span>
        </Link>
      </div>
    )
  }

  const Icon = pack.icon

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <h1 className="text-lg font-semibold">{t(`bundles.${pack.titleKey}.title`)}</h1>
          <ViewMoreLink label={more('more')} href={expertPackListHref()} className="ms-auto" />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t(`bundles.${pack.titleKey}.desc`)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t('packStepsHint')}</p>
      </header>

      <ol className="flex flex-col gap-2">
        {pack.members.map((marketKey, index) => {
          const market = MARKETS[marketKey]
          const MarketIcon = market.icon
          const sample = sampleLink(marketKey, overview)
          return (
            <li
              key={marketKey}
              className="rounded-xl border border-border bg-card p-3"
              data-market={marketKey}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <MarketIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link href={market.href} className="text-sm font-medium hover:underline">
                      {t(`cards.${marketKey}.title`)}
                    </Link>
                    <CountBadge count={overview.counts[marketKey]} />
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {t(`cards.${marketKey}.desc`)}
                  </p>
                  {sample ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{t('entrySample')}</span>
                      <Link
                        href={sample.href}
                        className="rounded-md bg-muted px-2 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        <span>{sample.label}</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="mt-4">
        <ViewMoreLink label={t('backToEcosystem')} href={ecosystemHubHref} />
      </div>
    </div>
  )
}
