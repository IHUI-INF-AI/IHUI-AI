'use client'

import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { ProviderHealthStatus } from '@/lib/models-api'

/**
 * H4 Phase B:Provider 状态徽章
 * 4 态:ok(绿)/ invalid_key(红)/ unreachable(橙)/ not_configured(灰)
 * 8px 圆点(装饰点豁免 rounded-full)+ provider 名 + 状态文字
 * hover Tooltip 显示延迟 + 模型数
 */

interface ProviderStatusBadgeProps {
  status: ProviderHealthStatus
  latency_ms?: number
  model_count?: number
  provider_name?: string
  /** 紧凑模式:只显示圆点 + 状态文字(不显示 provider 名),用于列表行 */
  compact?: boolean
}

const STATUS_CONFIG: Record<
  ProviderHealthStatus,
  { dot: string; text: string; label: string }
> = {
  ok: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: '可用',
  },
  invalid_key: {
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    label: 'Key 无效',
  },
  unreachable: {
    dot: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    label: '不可达',
  },
  not_configured: {
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
    label: '未配置',
  },
}

export function ProviderStatusBadge({
  status,
  latency_ms,
  model_count,
  provider_name,
  compact = false,
}: ProviderStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  // Tooltip 内容:延迟 + 模型数(provider_name 已在徽章显示,不重复)
  const tipParts: string[] = []
  if (typeof latency_ms === 'number') {
    tipParts.push(`延迟 ${latency_ms}ms`)
  }
  if (typeof model_count === 'number') {
    tipParts.push(`模型数 ${model_count}`)
  }
  const tip = tipParts.length > 0 ? tipParts.join(' · ') : config.label

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] transition-colors hover:bg-accent/50',
              config.text,
            )}
          >
            {/* 8px 圆点(装饰点豁免 rounded-full) */}
            <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', config.dot)} />
            {!compact && provider_name && (
              <span className="font-medium text-foreground">{provider_name}</span>
            )}
            <span className={config.text}>{config.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
