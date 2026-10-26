// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 账号保活中心面板(2026-10-26)。
 *
 * 账号页原先只有 `CookieAutoRefreshChip` 一行小字 —— 它只覆盖发布线 Cookie,而且
 * 守护没开时**整行不渲染**(用户看到的是"什么都没有",不是"没开")。本面板换成:
 *   - 三条线(cookie / 密钥到期 / 签到凭证)一份健康度,不要求用户知道来源差异;
 *   - 未启用时**显式说明缺哪个配置键**(后端 enabled_reason 原话透出),不装开启;
 *   - 失败账号给"重试",临期账号给到期时间 —— 面板的价值是能动手,不是好看。
 *
 * 只读 + 两个动作(全量保活 / 单账号重试),不改凭证、不改开关。
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, ShieldCheck } from 'lucide-react'

import {
  getKeepaliveOverview,
  runKeepalive,
  type KeepaliveAccountState,
  type KeepaliveHealth,
  type KeepaliveOverview,
} from '@ihui/api-client'

const HEALTH_ORDER: KeepaliveHealth[] = ['healthy', 'warning', 'critical', 'unknown']

/** 动态键映射:next-intl 不接受拼接出来的键名,显式映射才安全。 */
const HEALTH_LABEL: Record<KeepaliveHealth, string> = {
  healthy: 'healthHealthy',
  warning: 'healthWarning',
  critical: 'healthCritical',
  unknown: 'healthUnknown',
}

const HEALTH_TONE: Record<KeepaliveHealth, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-destructive',
  unknown: 'text-muted-foreground',
}

/** 来源显示名。同上:显式映射,不用拼接键。 */
const SOURCE_LABEL: Record<string, string> = {
  publish_cookie: 'sourceCookie',
  publish_token: 'sourceToken',
  checkin: 'sourceCheckin',
}

function formatTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function accountLabel(item: KeepaliveAccountState, fallback: string): string {
  const platform = item.platform || item.source
  const name = item.display || fallback
  return `${platform} · ${name}`
}

export function KeepaliveCenterPanel({ className }: { className?: string }) {
  const t = useTranslations('publish.keepalive')
  const [data, setData] = useState<KeepaliveOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getKeepaliveOverview()
      if (res.success && res.data) {
        setData(res.data)
        setFailed(false)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const trigger = useCallback(
    async (ref?: string) => {
      setBusy(true)
      try {
        await runKeepalive({ ref, force: true })
        // 后台执行,给一轮探活留出起步时间再刷新;失败不阻断界面。
        window.setTimeout(() => {
          void load()
        }, 3000)
      } catch {
        // 触发失败:保持当前数据,不谎报成功
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  if (loading) {
    return (
      <div
        className={`rounded-lg border border-border p-4 text-sm text-muted-foreground ${className ?? ''}`}
        data-testid="keepalive-center-loading"
      >
        {t('loading')}
      </div>
    )
  }

  // 请求失败一律不渲染:宁可没有面板,也不显示"全部健康"这种假状态。
  if (failed || !data) return null

  if (!data.config.enabled) {
    return (
      <div
        className={`rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 ${className ?? ''}`}
        data-testid="keepalive-center-disabled"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t('disabledTitle')}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{data.config.enabled_reason}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('disabledHint')}</p>
      </div>
    )
  }

  const needsAttention = data.needs_attention
  const expiring = data.expiring_soon

  return (
    <section
      className={`rounded-lg border border-border p-4 ${className ?? ''}`}
      data-testid="keepalive-center"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-medium">{t('title')}</h2>
          <span className="text-xs text-muted-foreground">
            {t('interval', { hours: data.config.interval_hours })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void trigger()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          {busy ? t('triggering') : t('triggerNow')}
        </button>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HEALTH_ORDER.map((health) => (
          <div key={health} className="rounded-md bg-muted/50 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{t(HEALTH_LABEL[health])}</dt>
            <dd className={`text-lg font-semibold ${HEALTH_TONE[health]}`}>
              {data.counts[health] ?? 0}
            </dd>
          </div>
        ))}
      </dl>

      {needsAttention.length === 0 && expiring.length === 0 ? (
        <p className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          {t('allHealthy', { total: data.total })}
        </p>
      ) : null}

      {needsAttention.length > 0 ? (
        <div className="mt-3">
          <h3 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t('needsAttention', { count: needsAttention.length })}
          </h3>
          <ul className="mt-1 space-y-1">
            {needsAttention.slice(0, 8).map((item) => (
              <li
                key={item.ref}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="min-w-0 truncate">
                  <span className={HEALTH_TONE[item.health]}>{t(HEALTH_LABEL[item.health])}</span>
                  <span className="mx-1 text-muted-foreground" aria-hidden>
                    ·
                  </span>
                  <span>{accountLabel(item, t('accountFallback', { id: item.account_id }))}</span>
                  {item.last_error ? (
                    <span className="ml-1 text-muted-foreground">{item.last_error}</span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {item.consecutive_failures > 0 ? (
                    <span>{t('failures', { count: item.consecutive_failures })}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void trigger(item.ref)}
                    disabled={busy}
                    className="rounded border border-border px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                  >
                    {t('retry')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {expiring.length > 0 ? (
        <div className="mt-3">
          <h3 className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden />
            {t('expiringSoon', { count: expiring.length })}
          </h3>
          <ul className="mt-1 space-y-1">
            {expiring.slice(0, 6).map((item) => (
              <li key={item.ref} className="text-xs text-muted-foreground">
                {accountLabel(item, t('accountFallback', { id: item.account_id }))}
                <span aria-hidden> · </span>
                {t('expiresAt', { time: formatTime(item.expires_at) })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Object.keys(data.success_rate_7d).length > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('rate7d')}
          {Object.entries(data.success_rate_7d).map(([source, bucket]) => (
            <span key={source} className="ml-2">
              {t(SOURCE_LABEL[source] ?? 'sourceCookie')}
              {': '}
              {bucket.rate === null ? t('rateUnknown') : `${Math.round((bucket.rate ?? 0) * 100)}%`}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
