// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import {
  listDeveloperApiKeysWithQuota,
  type DeveloperApiKeyWithQuota,
} from '@ihui/api-client/endpoints/developer-capabilities'
import { cn } from '@/lib/utils'
import { CountBadge } from './capability-badges'
import { KeyUsagePanel } from './key-usage-panel'
import { ScopeChip, classifyScope } from './scope-status'

/** 该 key 上「机器凭据必然 403」的 scope 数量(平台面 / 不对第三方开放 / 未登记)。 */
function blockedCount(apiKey: DeveloperApiKeyWithQuota): number {
  return apiKey.permissions.filter((scope) => classifyScope(scope).kind !== 'open').length
}

type KeysState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; list: DeveloperApiKeyWithQuota[] }

function formatExpiry(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

/**
 * 我的 key:展示每把 key 已授予的 scope,并把**永远不可申请**的项当场标红。
 * 目的是消除"申请了却永远 403 SCOPE_REQUIRED/M2M_FORBIDDEN"的暗坑 —— 判定复用后端
 * isM2MAllowed/getCapability(scope-status.tsx),界面不另立规则。
 */
export function MyKeysPanel(): React.JSX.Element {
  const t = useTranslations('developer.capabilities')
  const locale = useLocale()
  const [state, setState] = React.useState<KeysState>({ phase: 'loading' })
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let alive = true
    void listDeveloperApiKeysWithQuota().then((result) => {
      if (!alive) return
      if (!result.success) {
        setState({ phase: 'error', message: result.error })
        return
      }
      setState({ phase: 'ready', list: result.data.list })
      // 默认展开第一把 key 的用量,避免面板出现空占位
      setSelectedId(result.data.list[0]?.id ?? null)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('keysTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('keysSubtitle')}</p>
          </div>
        </div>

        {state.phase === 'loading' ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            <span>{t('keysLoading')}</span>
          </p>
        ) : state.phase === 'error' ? (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            {t('keysError')}
            <span className="ml-1 font-mono">{state.message}</span>
          </p>
        ) : state.list.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-3 py-3">
            <span className="text-xs text-muted-foreground">{t('keysEmpty')}</span>
            <Button asChild size="xs" variant="outline">
              <Link href="/developer/relay/keys">
                <span>{t('manageKeys')}</span>
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {state.list.map((apiKey) => {
              const blocked = blockedCount(apiKey)
              const expanded = selectedId === apiKey.id
              return (
                <li
                  key={apiKey.id}
                  className={cn(
                    'rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent/40',
                    expanded && 'bg-accent/30',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <span className="truncate">{apiKey.name}</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] leading-none font-medium',
                            apiKey.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {apiKey.status === 'active' ? t('keyActive') : t('keyRevoked')}
                        </span>
                        {blocked > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-rose-700 dark:text-rose-300">
                            <span>{t('blockedScopeLabel')}</span>
                            <CountBadge
                              count={blocked}
                              className="bg-rose-500/20 text-rose-700 dark:text-rose-200"
                            />
                          </span>
                        ) : null}
                      </p>
                      <code className="block truncate font-mono text-[11px] text-muted-foreground">
                        {apiKey.key}
                      </code>
                      <p className="text-[11px] text-muted-foreground">
                        {apiKey.expiresAt
                          ? t('keyExpires', { date: formatExpiry(apiKey.expiresAt, locale) })
                          : t('keyNoExpiry')}
                      </p>
                    </div>
                    <Button
                      size="xs"
                      variant={expanded ? 'secondary' : 'ghost'}
                      aria-pressed={expanded}
                      onClick={() => setSelectedId(expanded ? null : apiKey.id)}
                    >
                      <span>{t('viewUsage')}</span>
                    </Button>
                  </div>

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t('grantedScopes', { total: apiKey.permissions.length })}
                  </p>
                  {apiKey.permissions.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {apiKey.permissions.map((scope) => (
                        <ScopeChip key={scope} scope={scope} />
                      ))}
                    </div>
                  ) : null}

                  {expanded ? (
                    <div className="mt-3">
                      <KeyUsagePanel apiKey={apiKey} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
