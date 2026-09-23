// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import {
  getCookieHealth,
  refreshAccountCookie,
  type CookieHealthInfo,
  type CookieHealthLevel,
} from '@ihui/api-client'
import { Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'

/**
 * 展示形态:
 * - badge+button(默认):健康徽章 + 刷新按钮(整组)
 * - badge:仅健康徽章(按钮由页面放到其他位置)
 * - button:仅刷新按钮
 */
export type CookieHealthVariant = 'badge+button' | 'badge' | 'button'

export interface CookieHealthIndicatorProps {
  readonly accountId: number
  readonly initialLevel?: CookieHealthLevel
  /**
   * 页面批量端点取回的健康度。
   * 与 `managed` 配套:`managed` 为真时本组件永不自行请求,只渲染这份数据。
   */
  readonly health?: CookieHealthInfo | null
  /**
   * 该实例由页面的 `/accounts/health-summary` 批量请求统一供数。
   * 必须显式声明 —— 否则首帧批量尚未返回,每张卡片都会各自发一次 cookie-health,
   * 19 个账号仍是 19 次扇出(2026-09-23 IP 封禁事故的正是这条路径)。
   */
  readonly managed?: boolean
  readonly compact?: boolean
  readonly onRefreshed?: () => void
  readonly variant?: CookieHealthVariant
}

const LEVEL_CONFIG: Record<CookieHealthLevel, { dot: string; label: string; text: string }> = {
  healthy: {
    dot: 'bg-emerald-500',
    label: 'cookieHealth.healthy',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  expiring: {
    dot: 'bg-amber-500',
    label: 'cookieHealth.expiring',
    text: 'text-amber-600 dark:text-amber-400',
  },
  expired: {
    dot: 'bg-rose-500',
    label: 'cookieHealth.expired',
    text: 'text-rose-600 dark:text-rose-400',
  },
}

const TIME_FMT = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Shanghai',
})

export function CookieHealthIndicator({
  accountId,
  initialLevel,
  health,
  managed,
  compact,
  onRefreshed,
  variant = 'badge+button',
}: CookieHealthIndicatorProps) {
  const t = useTranslations('publish')
  const toast = useToast()
  // 非托管模式下组件自己拉到的那份;托管模式一律用页面批量供的 health
  const [fetched, setFetched] = React.useState<CookieHealthInfo | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)
  const [hovered, setHovered] = React.useState(false)

  const data = health ?? fetched
  const level: CookieHealthLevel = data?.level ?? initialLevel ?? 'expired'
  const detail = data
    ? {
        lastVerified: data.last_verified_at,
        predictedExpiry: data.predicted_expiry,
        daysSince: data.days_since_verified,
      }
    : null

  const loadHealth = React.useCallback(async () => {
    try {
      const r = await getCookieHealth(accountId)
      if (r.success && r.data) setFetched(r.data)
    } catch {
      // 静默失败,不影响主界面
    }
  }, [accountId])

  // 托管模式(页面批量供数)与 variant='button'(不渲染徽章)都不得自己发请求 ——
  // 省掉的正是那批随账号数线性增长的请求(2026-09-23 IP 封禁事故)。
  const needsOwnFetch = !managed && variant !== 'button' && !health
  React.useEffect(() => {
    if (!needsOwnFetch) return
    void loadHealth()
  }, [needsOwnFetch, loadHealth])

  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation()
    setRefreshing(true)
    try {
      const r = await refreshAccountCookie(accountId)
      if (r.success && r.data) {
        if (r.data.success) {
          toast.success(t('cookieHealth.refreshSuccess'))
          // 托管模式由页面 reload() 走批量端点供数,不再逐账号补一发请求
          if (!managed) await loadHealth()
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
  // 托管模式下批量尚未返回时不渲染徽章,避免先闪一帧红色"已过期"
  const showBadge = variant !== 'button' && (!managed || !!health)
  const showButton = variant !== 'badge'

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showBadge && (
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
            cfg.text,
            !compact && 'bg-muted/40',
          )}
        >
          <span className={cn('inline-block h-2 w-2 rounded-full', cfg.dot)} aria-hidden />
          {!compact && <span>{t(cfg.label)}</span>}
        </div>
      )}
      {showButton && (
        <Tooltip content={t('cookieHealth.refresh')}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50',
              showBadge && 'ml-1',
            )}
            aria-label={t('cookieHealth.refresh')}
          >
            {refreshing ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <RefreshCw className="h-2.5 w-2.5" />
            )}
          </button>
        </Tooltip>
      )}

      {hovered && detail && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-48 rounded-md border border-border bg-popover p-3 text-xs shadow-md">
          <div className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t('cookieHealth.lastVerified')}</span>
              <span>
                {detail.lastVerified ? TIME_FMT.format(new Date(detail.lastVerified)) : '-'}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t('cookieHealth.predictedExpiry')}</span>
              <span>
                {detail.predictedExpiry ? TIME_FMT.format(new Date(detail.predictedExpiry)) : '-'}
              </span>
            </div>
            {detail.daysSince !== null && (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">{t('cookieHealth.daysSince')}</span>
                <span>
                  {detail.daysSince.toFixed(1)} {t('cookieHealth.days')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
