// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import {
  getDeveloperApiKeyUsage,
  type DeveloperApiKeyUsage,
  type DeveloperApiKeyWithQuota,
} from '@ihui/api-client/endpoints/developer-capabilities'

/** 时间一律用 Intl.DateTimeFormat(AGENTS.md §4),不手拼字符串。 */
function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

type UsageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; usage: DeveloperApiKeyUsage }

/** 真实用量:来自有端点的 GET /api/developer/api-keys/:id/usage。 */
function UsageSummary({
  usage,
  locale,
}: {
  usage: DeveloperApiKeyUsage
  locale: string
}): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground tabular-nums">
        {t('callsTotal', { times: usage.callCount })}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {usage.lastUsedAt
          ? t('lastUsedAt', { time: formatDateTime(usage.lastUsedAt, locale) })
          : t('lastUsedNever')}
      </p>
      {usage.topEndpoints.length > 0 ? (
        <ul className="space-y-1">
          <li className="text-[11px] font-semibold">{t('topEndpoints')}</li>
          {usage.topEndpoints.map((endpoint) => (
            <li
              key={`${endpoint.method} ${endpoint.path}`}
              className="flex items-center gap-2 text-[11px] text-muted-foreground"
            >
              <code className="truncate font-mono">
                {endpoint.method} {endpoint.path}
              </code>
              <span className="ml-auto rounded bg-background px-1.5 py-0.5 tabular-nums">
                {endpoint.count}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * 用量与熔断面板。
 * - 窗口**上限**(5h/1d/7d)来自 key 配置,真实可读;
 * - 窗口**已用量**后端没有只读端点(窗口计数只在鉴权链路内部消费),因此显式标「暂无数据」,
 *   绝不用 0 冒充 —— 编造数字会让人误判熔断余量;
 * - 累计调用次数 / 最近使用 / 高频端点走真实端点。
 */
export function KeyUsagePanel({ apiKey }: { apiKey: DeveloperApiKeyWithQuota }): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const locale = useLocale()
  const [state, setState] = React.useState<UsageState>({ phase: 'loading' })

  React.useEffect(() => {
    let alive = true
    setState({ phase: 'loading' })
    void getDeveloperApiKeyUsage(apiKey.id).then((result) => {
      if (!alive) return
      setState(
        result.success
          ? { phase: 'ready', usage: result.data }
          : { phase: 'error', message: result.error },
      )
    })
    return () => {
      alive = false
    }
  }, [apiKey.id])

  const windows: ReadonlyArray<readonly [string, number | null]> = [
    ['window5h', apiKey.rateLimit5h],
    ['window1d', apiKey.rateLimit1d],
    ['window7d', apiKey.rateLimit7d],
  ]

  return (
    <div className="space-y-3 rounded-md bg-muted/60 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <h4 className="text-xs font-semibold">{t('usageTitle')}</h4>
        <span className="text-[11px] text-muted-foreground">{t('rateLimitNote')}</span>
      </div>

      <ul className="space-y-1">
        {windows.map(([labelKey, limit]) => (
          <li
            key={labelKey}
            className="flex flex-wrap items-center gap-2 rounded bg-background px-2 py-1.5 text-[11px]"
          >
            <span className="min-w-14 font-medium">{t(labelKey)}</span>
            <span className="text-muted-foreground">
              {t('usedLabel')} <span className="rounded bg-muted px-1.5 py-0.5">{t('noUsageData')}</span>
            </span>
            <span className="ml-auto text-muted-foreground">
              {t('limitLabel')}{' '}
              {limit === null ? (
                t('windowUnlimited')
              ) : (
                <span className="font-medium text-foreground tabular-nums">
                  {new Intl.NumberFormat(locale).format(limit)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {state.phase === 'ready' ? (
        <UsageSummary usage={state.usage} locale={locale} />
      ) : state.phase === 'error' ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">
          {t('usageError')}
          <span className="ml-1 font-mono">{state.message}</span>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          <span>{t('usageLoading')}</span>
        </p>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
