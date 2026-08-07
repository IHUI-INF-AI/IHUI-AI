'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { Bot, Sparkles, Building2, Gift, Activity, RefreshCw, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { fetchProvidersHealthSummary } from '@/lib/models-api'
import type { ProvidersHealthResponse } from '@/lib/models-api'
import { Tooltip } from '@/components/feedback'
import { ProviderStatusBadge } from './ProviderStatusBadge'

interface Props {
  /** 当前可见模型总数(已应用 provider 过滤) */
  total: number
  /** 免费模型数量 */
  freeCount: number
  /** 当前可见的厂商数量 */
  providerCount: number
  /** 推荐(highlight)模型数量 */
  highlightCount: number
}

/**
 * 模型广场页头:标题 + 副标题 + 4 项快速统计 + Provider 状态总览
 * 统计卡片使用容器背景色对比区分(无单边 border,符合项目规范)
 * H4 Phase B:右上角 Provider 状态总览,点击展开 Dialog 显示每个 provider 的徽章
 */
export function ModelsHeader({ total, freeCount, providerCount, highlightCount }: Props) {
  const t = useTranslations('models')

  const stats = [
    {
      key: 'total',
      icon: Bot,
      label: t('header.stats.total'),
      value: total,
      tone: 'primary' as const,
    },
    {
      key: 'highlight',
      icon: Sparkles,
      label: t('header.stats.highlight'),
      value: highlightCount,
      tone: 'amber' as const,
    },
    {
      key: 'free',
      icon: Gift,
      label: t('header.stats.free'),
      value: freeCount,
      tone: 'emerald' as const,
    },
    {
      key: 'providers',
      icon: Building2,
      label: t('header.stats.providers'),
      value: providerCount,
      tone: 'sky' as const,
    },
  ]

  const toneClass: Record<'primary' | 'amber' | 'emerald' | 'sky', string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  }

  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight min-[768px]:text-2xl [&>span]:translate-y-[var(--text-vcenter-offset)]">
            <Bot className="h-7 w-7 text-primary" />
            <span>{t('title')}</span>
          </h1>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
        {/* H4 Phase B:Provider 状态总览 */}
        <ProviderStatusSummary />
      </div>

      <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.key}
              className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/70"
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  toneClass[s.tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold leading-tight">{s.value}</div>
                <div className="truncate text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </header>
  )
}

/**
 * Provider 状态总览徽章(模型广场页头右上角)
 * - 加载中:"检测中..."(灰)
 * - 失败:"不可用"(灰)
 * - 成功:"{healthy}/{total} 可用",点击展开 Dialog 显示每个 provider 的 ProviderStatusBadge
 */
function ProviderStatusSummary() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['models-header-providers-health'],
    queryFn: () => fetchProvidersHealthSummary(true),
    staleTime: 30_000,
  })
  const [open, setOpen] = React.useState(false)

  // 状态文字 + 圆点颜色
  const summary = React.useMemo(() => {
    if (isLoading)
      return { dot: 'bg-muted-foreground/40', text: '检测中...', tone: 'text-muted-foreground' }
    if (isError || !data)
      return { dot: 'bg-muted-foreground/40', text: '不可用', tone: 'text-muted-foreground' }
    const allHealthy = data.healthy_count === data.total && data.total > 0
    return {
      dot: allHealthy ? 'bg-emerald-500' : data.healthy_count > 0 ? 'bg-orange-500' : 'bg-red-500',
      text: `${data.healthy_count}/${data.total} 可用`,
      tone: allHealthy
        ? 'text-emerald-600 dark:text-emerald-400'
        : data.healthy_count > 0
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400',
    }
  }, [data, isLoading, isError])

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip content="重新检测">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 px-2 text-[11px] text-muted-foreground"
          >
            {isFetching ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </Tooltip>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={isLoading || isError || !data}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-accent/50',
            summary.tone,
          )}
        >
          <Activity className="h-3 w-3" />
          {/* 8px 圆点(装饰点豁免 rounded-full) */}
          <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', summary.dot)} />
          <span className="font-medium">{summary.text}</span>
        </button>
      </div>
      {data && (
        <ProviderStatusDialog
          open={open}
          onOpenChange={setOpen}
          data={data}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
        />
      )}
    </>
  )
}

/** Provider 状态详情 Dialog(展开显示每个 provider 的徽章列表) */
function ProviderStatusDialog({
  open,
  onOpenChange,
  data,
  onRefresh,
  isRefreshing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ProvidersHealthResponse
  onRefresh: () => void
  isRefreshing: boolean
}) {
  const timeFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Provider 状态</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 总览 + 最后检测时间 */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {data.healthy_count}/{data.total} 可用
            </span>
            <span className="text-muted-foreground">
              最后检测:{data.checked_at ? timeFmt.format(new Date(data.checked_at)) : '—'}
            </span>
          </div>
          {/* Provider 列表 */}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {data.providers.map((p) => (
              <div
                key={p.provider}
                className="flex items-center justify-between rounded bg-muted/30 px-2 py-1.5"
              >
                <ProviderStatusBadge
                  status={p.status}
                  latency_ms={p.latency_ms}
                  model_count={p.model_count}
                  provider_name={p.display_name || p.provider}
                />
                <span className="text-[10px] text-muted-foreground">{p.provider}</span>
              </div>
            ))}
            {data.providers.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无 Provider</p>
            )}
          </div>
          {/* 重新检测按钮 */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 px-2.5 text-xs"
            >
              {isRefreshing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              重新检测
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
