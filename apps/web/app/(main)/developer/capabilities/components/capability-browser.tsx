// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  CAPABILITY_CATALOG,
  CAPABILITY_DOMAINS,
  type CapabilityDomain,
  type CapabilityEntry,
} from '@ihui/types'
import { Card, CardContent, SearchInput } from '@ihui/ui-react'
import { BADGE_BASE, CountBadge, DataClassBadge, FlagBadge, RiskBadge } from './capability-badges'
import { cn } from '@/lib/utils'

/** 命中判定:scope / 说明 / 端点 / 工具名 / 域名 任一含关键词即可。 */
function matchesKeyword(entry: CapabilityEntry, keyword: string): boolean {
  if (!keyword) return true
  const kw = keyword.toLowerCase()
  return (
    entry.scope.toLowerCase().includes(kw) ||
    entry.description.toLowerCase().includes(kw) ||
    entry.domain.toLowerCase().includes(kw) ||
    entry.routes.some((r) => r.toLowerCase().includes(kw)) ||
    (entry.tools ?? []).some((tool) => tool.toLowerCase().includes(kw))
  )
}

const TOTAL_CAPABILITIES = CAPABILITY_CATALOG.length

/** 单条能力:scope + 四态 dataClass + 风险 + 计费/第三方/幂等 + 端点与工具清单。 */
function CapabilityRow({ entry }: { entry: CapabilityEntry }): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  return (
    <li className="rounded-md bg-muted/50 p-3 transition-colors hover:bg-muted">
      <div className="flex flex-wrap items-center gap-1.5">
        <code className="font-mono text-xs font-semibold">{entry.scope}</code>
        <DataClassBadge entry={entry} />
        <RiskBadge entry={entry} />
        <FlagBadge
          on={entry.billable}
          onLabel={t('billable')}
          offLabel={t('free')}
          tone="warn"
        />
        <FlagBadge
          on={!entry.thirdPartyEligible}
          onLabel={t('thirdPartyNo')}
          offLabel={t('thirdPartyYes')}
          tone="danger"
        />
        {entry.idempotencyRequired ? (
          <span className={cn(BADGE_BASE, 'bg-muted text-muted-foreground')}>
            {t('idempotencyRequired')}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {entry.routes.map((route) => (
          <code
            key={route}
            className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
          >
            {route}
          </code>
        ))}
      </div>
      {entry.tools?.length ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>{t('toolsLabel')}</span>
          <CountBadge count={entry.tools.length} />
        </p>
      ) : null}
    </li>
  )
}

/** 能力目录浏览:按 domain 分组 + 搜索(数据源 = @ihui/types 单一事实源,非二次维护)。 */
export function CapabilityBrowser(): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const [keyword, setKeyword] = React.useState('')

  const groups = React.useMemo(
    () =>
      CAPABILITY_DOMAINS.map((domain: CapabilityDomain) => ({
        domain,
        entries: CAPABILITY_CATALOG.filter(
          (entry) => entry.domain === domain && matchesKeyword(entry, keyword.trim().toLowerCase()),
        ),
      })).filter((group) => group.entries.length > 0),
    [keyword],
  )

  const matched = groups.reduce((sum, group) => sum + group.entries.length, 0)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <SearchInput
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          clearable
          size="lg"
          wrapperClassName="w-full"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {t('resultSummary', { matched, total: TOTAL_CAPABILITIES })}
        </p>

        {matched === 0 ? (
          <p className="rounded-md bg-muted/60 px-3 py-6 text-center text-xs text-muted-foreground">
            {t('emptyResult')}
          </p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.domain} className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                  <span>{t(`domain.${group.domain}`, { defaultValue: group.domain })}</span>
                  <CountBadge count={group.entries.length} />
                </h3>
                <ul className="space-y-2">
                  {group.entries.map((entry) => (
                    <CapabilityRow key={entry.scope} entry={entry} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
