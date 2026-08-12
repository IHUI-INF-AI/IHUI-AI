'use client'

/**
 * Cookie 健康度指示器(2026-08-01 新增)。
 *
 * 显示账号 Cookie 的健康状态:
 * - healthy(绿色):最近 7 天内验证过
 * - expiring(黄色):7-14 天内验证过,即将过期
 * - expired(红色):超过 14 天或从未验证
 *
 * 悬停显示详情(上次验证时间 / 预测过期时间),提供一键刷新按钮。
 * AGENTS.md §4:rounded-md / 无分割线 / subtle 配色 / 禁渐变遮罩 / 禁 rounded-full(指示点豁免)
 */

import * as React from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { getCookieHealth, refreshAccountCookie, type CookieHealthLevel } from '@ihui/api-client'
import { Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'

export interface CookieHealthIndicatorProps {
  readonly accountId: number
  readonly initialLevel?: CookieHealthLevel
  readonly compact?: boolean
  readonly onRefreshed?: () => void
}

const LEVEL_CONFIG: Record<CookieHealthLevel, { dot: string; label: string; text: string }> = {
  healthy: { dot: 'bg-emerald-500', label: 'cookieHealth.healthy', text: 'text-emerald-600 dark:text-emerald-400' },
  expiring: { dot: 'bg-amber-500', label: 'cookieHealth.expiring', text: 'text-amber-600 dark:text-amber-400' },
  expired: { dot: 'bg-rose-500', label: 'cookieHealth.expired', text: 'text-rose-600 dark:text-rose-400' },
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
})

export function CookieHealthIndicator({ accountId, initialLevel, compact, onRefreshed }: CookieHealthIndicatorProps) {
  const t = useTranslations('publish')
  const toast = useToast()
  const [level, setLevel] = React.useState<CookieHealthLevel>(initialLevel ?? 'expired')
  const [detail, setDetail] = React.useState<{ lastVerified: string | null; predictedExpiry: string | null; daysSince: number | null } | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)

  const loadHealth = React.useCallback(async () => {
    try {
      const r = await getCookieHealth(accountId)
      if (r.success && r.data) {
        setLevel(r.data.level)
        setDetail({
          lastVerified: r.data.last_verified_at,
          predictedExpiry: r.data.predicted_expiry,
          daysSince: r.data.days_since_verified,
        })
      }
    } catch {
      // 静默失败,不影响主界面
    }
  }, [accountId])

  React.useEffect(() => { void loadHealth() }, [loadHealth])

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation()
    setRefreshing(true)
    try {
      const r = await refreshAccountCookie(accountId)
      if (r.success && r.data) {
        if (r.data.success) {
          toast.success(t('cookieHealth.refreshSuccess'))
          setLevel('healthy')
          await loadHealth()
          onRefreshed?.()
        } else {
          toast.error(r.data.message || t('cookieHealth.refreshFailed'))
        }
      } else if (!r.success) {
        toast.error(r.error || t('cookieHealth.refreshFailed'))
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  const cfg = LEVEL_CONFIG[level]

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium', cfg.text, !compact && 'bg-muted/40')}>
        <span className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)} aria-hidden />
        {!compact && <span>{t(cfg.label)}</span>}
      </div>
      <Tooltip content={t('cookieHealth.refresh')}>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          aria-label={t('cookieHealth.refresh')}
        >
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </button>
      </Tooltip>

      {hovered && detail && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border border-border bg-popover p-2 text-xs shadow-md">
          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t('cookieHealth.lastVerified')}</span>
              <span>{detail.lastVerified ? TIME_FMT.format(new Date(detail.lastVerified)) : '-'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t('cookieHealth.predictedExpiry')}</span>
              <span>{detail.predictedExpiry ? TIME_FMT.format(new Date(detail.predictedExpiry)) : '-'}</span>
            </div>
            {detail.daysSince !== null && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t('cookieHealth.daysSince')}</span>
                <span>{detail.daysSince.toFixed(1)} {t('cookieHealth.days')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
