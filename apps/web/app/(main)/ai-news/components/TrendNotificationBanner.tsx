'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flame, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { fetchAiFeedNotifications, type TrendNotification } from '@/lib/ai-news-api'

const POLL_INTERVAL_MS = 60_000
const AUTO_COLLAPSE_MS = 5_000
const NOTIFICATION_HOURS = 6
const NOTIFICATION_MIN_GROWTH = 50
const NOTIFICATION_LIMIT = 5

/**
 * 趋势爆发通知 Banner。
 *
 * 每 60 秒轮询 /api/ai-feed/notifications,有 rising 条目时在 section 顶部展示橙色 banner。
 * 默认折叠态显示"🔥 X 资讯热度爆发 + 最新一条标题",点击展开查看完整列表,
 * 5 秒后自动折叠或手动关闭。错误时静默忽略,不阻塞页面。
 */
export function TrendNotificationBanner() {
  const t = useTranslations('aiNews')
  const [notifications, setNotifications] = React.useState<TrendNotification[]>([])
  const [expanded, setExpanded] = React.useState(false)
  const [closed, setClosed] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const poll = React.useCallback(async () => {
    try {
      const list = await fetchAiFeedNotifications(
        NOTIFICATION_HOURS,
        NOTIFICATION_MIN_GROWTH,
        NOTIFICATION_LIMIT,
      )
      if (list.length > 0) {
        setNotifications(list)
        setClosed(false)
      } else {
        setNotifications([])
      }
    } catch {
      // 静默忽略,不阻塞页面
    }
  }, [])

  React.useEffect(() => {
    void poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [poll])

  // 自动折叠:展开后 5 秒自动收回
  React.useEffect(() => {
    if (!expanded) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setExpanded(false), AUTO_COLLAPSE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [expanded])

  const handleDismiss = React.useCallback(() => {
    setClosed(true)
    setExpanded(false)
  }, [])

  if (closed || notifications.length === 0) return null

  const latest = notifications[0]!
  const growthPct = latest.trendGrowthPct !== null && latest.trendGrowthPct !== undefined
    ? Math.round(latest.trendGrowthPct)
    : null

  return (
    <div className="mx-6 mt-2 mb-1 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 dark:border-orange-800 dark:bg-orange-950/20">
      {/* 折叠态:🔥 X 资讯热度爆发 + 最新标题 + 增长率 */}
      <div className="flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 shrink-0 text-orange-500" />
        <span className="shrink-0 text-xs font-semibold text-orange-700 dark:text-orange-300">
          {t('feed.trendNotifyTitle', { count: notifications.length })}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-orange-600 dark:text-orange-400">
          {latest.title}
        </span>
        {growthPct !== null ? (
          <span className="shrink-0 rounded-sm bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-orange-700 dark:text-orange-300">
            +{growthPct}%
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t('feed.trendNotifyCollapse') : t('feed.trendNotifyExpand')}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-orange-600 transition-colors hover:bg-orange-500/15 dark:text-orange-400"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('feed.trendNotifyClose')}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-orange-600 transition-colors hover:bg-orange-500/15 dark:text-orange-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* 展开态:完整通知列表 */}
      {expanded ? (
        <div className="mt-2 space-y-1.5 pl-5">
          {notifications.map((n) => {
            const pct = n.trendGrowthPct !== null && n.trendGrowthPct !== undefined
              ? Math.round(n.trendGrowthPct)
              : null
            const inner = (
              <>
                <span className="min-w-0 flex-1 truncate text-xs text-orange-700 dark:text-orange-300">
                  {n.title}
                </span>
                {pct !== null ? (
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    +{pct}%
                  </span>
                ) : null}
                {n.url ? (
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 text-orange-500/70" />
                ) : null}
              </>
            )
            return (
              <div key={n.id} className="flex items-center gap-1.5">
                {n.url ? (
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-orange-500/10"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="flex flex-1 items-center gap-1.5 px-1 py-0.5">{inner}</div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
