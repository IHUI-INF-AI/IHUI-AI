// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// 平台特有:D17 专家包列表页,依赖 next/link 与 next-intl,不适合共享层

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { ViewMoreLink } from '@/components/common/view-more-link'
import { CountBadge } from '@/components/ecosystem/count-badge'
import {
  EXPERT_PACKS,
  ecosystemHubHref,
  expertPackDetailHref,
} from '@/components/ecosystem/expert-packs'
import { useEcosystemOverview } from '@/components/ecosystem/use-ecosystem-overview'

export default function ExpertPacksPageClient() {
  const t = useTranslations('ecosystem')
  const more = useTranslations('common')
  const { counts } = useEcosystemOverview()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{t('bundlesSection')}</h1>
          <ViewMoreLink label={more('more')} href={ecosystemHubHref} className="ms-auto" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('bundlesHint')}</p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {EXPERT_PACKS.map((pack) => {
          const Icon = pack.icon
          return (
            <Link
              key={pack.slug}
              href={expertPackDetailHref(pack.slug)}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {t(`bundles.${pack.titleKey}.title`)}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {t(`bundles.${pack.titleKey}.desc`)}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t('packMembers', { count: pack.members.length })}
                  </span>
                  {pack.members.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      <span>{t(`cards.${key}.title`)}</span>
                      <CountBadge count={counts[key]} />
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">{t('expertPackFooterHint')}</p>
    </div>
  )
}
