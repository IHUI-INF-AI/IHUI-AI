'use client'

import * as React from 'react'
import { MessageSquare } from 'lucide-react'
import { Badge } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { ImAdapterConfig, ImGatewayStatus, ImPlatformMeta } from '@ihui/types'
import type { PlatformStatusView } from './types'

interface PlatformListProps {
  platforms: ImPlatformMeta[]
  adapters: ImAdapterConfig[]
  statuses: ImGatewayStatus[]
  selected: string | undefined
  onSelect: (platform: string) => void
}

/** 计算每个平台的展示状态(configured / enabled / none) */
function buildStatusViews(
  platforms: ImPlatformMeta[],
  adapters: ImAdapterConfig[],
  statuses: ImGatewayStatus[],
): PlatformStatusView[] {
  const adapterMap = new Map<string, ImAdapterConfig>(adapters.map((a) => [a.platform, a]))
  const statusMap = new Map<string, ImGatewayStatus>(statuses.map((s) => [s.platform, s]))
  return platforms.map<PlatformStatusView>((p) => {
    const adapter = adapterMap.get(p.platform)
    const status = statusMap.get(p.platform)
    const state: PlatformStatusView['state'] = adapter
      ? adapter.enabled
        ? 'enabled'
        : 'configured'
      : 'none'
    return {
      platform: p.platform,
      displayName: p.displayName,
      icon: p.icon,
      state,
      connected: status?.connected ?? false,
      messageCount: status?.messageCount ?? 0,
      lastMessageAt: status?.lastMessageAt,
      error: status?.error,
    }
  })
}

const STATE_BADGE: Record<PlatformStatusView['state'], { label: string; className: string }> = {
  enabled: {
    label: '已启用',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400',
  },
  configured: {
    label: '已配置',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  none: {
    label: '未配置',
    className: 'bg-muted text-muted-foreground',
  },
}

export default function PlatformList({
  platforms,
  adapters,
  statuses,
  selected,
  onSelect,
}: PlatformListProps) {
  const views = React.useMemo(
    () => buildStatusViews(platforms, adapters, statuses),
    [platforms, adapters, statuses],
  )

  if (platforms.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        暂无平台元数据
      </div>
    )
  }

  return (
    <nav className="space-y-1" aria-label="IM 平台列表">
      {views.map((v) => {
        const isSelected = selected === v.platform
        const badge = STATE_BADGE[v.state]
        return (
          <button
            key={v.platform}
            type="button"
            onClick={() => onSelect(v.platform)}
            aria-current={isSelected ? 'true' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'bg-muted',
            )}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium"
              aria-hidden
            >
              {v.icon ?? v.displayName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{v.displayName}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" aria-hidden />
                <span className="tabular-nums">{v.messageCount}</span>
                <span aria-hidden>·</span>
                <span>{v.connected ? '已连接' : '未连接'}</span>
              </span>
            </span>
            <Badge variant="outline" className={cn('text-xs', badge.className)}>
              {badge.label}
            </Badge>
          </button>
        )
      })}
    </nav>
  )
}
