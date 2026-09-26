// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:web 端生态统一入口聚合页(D17),依赖 next/link 与 next-intl,不适合共享层

'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { ViewMoreLink } from '@/components/common/view-more-link'

import { CountBadge } from './count-badge'
import {
  EXPERT_PACKS,
  MARKETS,
  MARKET_ORDER,
  connectorAuthDetailHref,
  expertPackDetailHref,
  expertPackListHref,
  skillDetailHref,
} from './expert-packs'
import { useEcosystemOverview } from './use-ecosystem-overview'

const CARD_CLASS =
  'flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent'

export function EcosystemHub() {
  const t = useTranslations('ecosystem')
  const tc = useTranslations('connectors')
  const more = useTranslations('common')
  const { counts, connectors, skills } = useEcosystemOverview()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('description')}</p>
      </header>

      <section aria-labelledby="ecosystem-packs" className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="ecosystem-packs" className="text-sm font-medium">
            {t('bundlesSection')}
          </h2>
          <ViewMoreLink label={more('more')} href={expertPackListHref()} />
        </div>
        <p className="mb-2 text-xs text-muted-foreground">{t('bundlesHint')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXPERT_PACKS.map((pack) => {
            const Icon = pack.icon
            return (
              <Link
                key={pack.slug}
                href={expertPackDetailHref(pack.slug)}
                className={`${CARD_CLASS} flex-col items-stretch gap-0`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium">{t(`bundles.${pack.titleKey}.title`)}</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t(`bundles.${pack.titleKey}.desc`)}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t('packMembers', { count: pack.members.length })}
                  </span>
                  {pack.members.map((marketKey) => (
                    <span
                      key={marketKey}
                      className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                    >
                      {t(`cards.${marketKey}.title`)}
                    </span>
                  ))}
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="ecosystem-skills" className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 id="ecosystem-skills" className="text-sm font-medium">
            {t('skillsSection')}
          </h2>
          <CountBadge count={counts.skillsMarket} />
          <ViewMoreLink
            label={more('more')}
            href={MARKETS.skillsMarket.href}
            className="ms-auto"
          />
        </div>
        {skills.status === 'ready' && skills.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('emptySkills')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {skills.items.map((item) => (
              <li key={item.name}>
                <Link href={skillDetailHref(item.name)} className={CARD_CLASS}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {t('skillInstalls', { count: item.installCount })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ecosystem-connectors" className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <h2 id="ecosystem-connectors" className="text-sm font-medium">
            {t('connectorsSection')}
          </h2>
          <CountBadge count={counts.connectors} />
          <ViewMoreLink
            label={more('more')}
            href={MARKETS.connectors.href}
            className="ms-auto"
          />
        </div>
        <p className="mb-2 text-xs text-muted-foreground">{t('connectorsHint')}</p>
        {connectors.status === 'ready' && connectors.entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('emptyConnectors')}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {connectors.entries.map((entry) => (
              <li key={entry.key}>
                <Link href={connectorAuthDetailHref(entry.key)} className={CARD_CLASS}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {tc(entry.configured ? 'configured' : 'notConfigured')}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t('connectorAuthDetail')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ecosystem-markets">
        <h2 id="ecosystem-markets" className="mb-2 text-sm font-medium">
          {t('marketsSection')}
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MARKET_ORDER.map((key) => {
            const market = MARKETS[key]
            const Icon = market.icon
            return (
              <Link key={key} href={market.href} className={CARD_CLASS}>
                <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{t(`cards.${key}.title`)}</span>
                    <CountBadge count={counts[key]} />
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {t(`cards.${key}.desc`)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
