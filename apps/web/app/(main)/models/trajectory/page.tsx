'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Activity,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
  Badge,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'

/* ─── API helpers ─── */

async function fetchTraces(): Promise<TraceItem[]> {
  const res = await fetchApi<TraceItem[]>('/api/agent/traces')
  if (!res.success) throw new Error(res.error)
  return res.data ?? []
}

async function fetchTraceDetail(sessionId: string): Promise<TraceDetail> {
  const res = await fetchApi<TraceDetail>(`/api/agent/trace/${encodeURIComponent(sessionId)}`)
  if (!res.success) throw new Error(res.error)
  return res.data!
}

/* ─── Types ─── */

interface TraceStep {
  step: number
  reasoning: string
  tool_calls: string[]
  result: string
  duration_ms: number
}

interface TraceItem {
  session_id: string
  goal: string
  timestamp: string
  steps: number
  status: 'completed' | 'error'
}

interface TraceDetail {
  session_id: string
  goal: string
  timestamp: string
  status: 'completed' | 'error'
  steps: TraceStep[]
}

/* ─── Helpers ─── */

function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}min`
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`
  return `${ms}ms`
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return ts
  }
}

function truncateSessionId(id: string, maxLen = 16): string {
  if (id.length <= maxLen) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

/* ─── TraceCard ─── */

function TraceCard({
  trace,
  t,
  onToggle,
  expanded,
}: {
  trace: TraceItem
  t: ReturnType<typeof useTranslations<'models'>>
  onToggle: () => void
  expanded: boolean
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm font-medium">{truncateSessionId(trace.session_id)}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{trace.session_id}</p>
                </TooltipContent>
              </Tooltip>
              <Badge
                variant={trace.status === 'completed' ? 'default' : 'destructive'}
                className="shrink-0"
              >
                {trace.status === 'completed'
                  ? t('trajectory.statusCompleted')
                  : t('trajectory.statusError')}
              </Badge>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="truncate">{trace.goal}</span>
              <span className="shrink-0">{t('trajectory.steps')}: {trace.steps}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-muted-foreground min-[480px]:inline">
              {formatTimestamp(trace.timestamp)}
            </span>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardContent>
    </Card>
  )
}

/* ─── TraceDetailCard ─── */

function TraceDetailCard({
  detail,
  t,
}: {
  detail: TraceDetail
  t: ReturnType<typeof useTranslations<'models'>>
}) {
  return (
    <div className="space-y-3 border-l-2 border-primary/20 pl-4">
      {detail.steps.map((step) => (
        <Card key={step.step}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-medium text-primary">
                {step.step}
              </span>
              <span>
                {t('trajectory.step')} {step.step}
              </span>
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(step.duration_ms)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {/* 推理过程 */}
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('trajectory.reasoning')}
              </span>
              <div className="rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                {step.reasoning}
              </div>
            </div>

            {/* 工具调用 */}
            {step.tool_calls.length > 0 && (
              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t('trajectory.toolCalls')}
                </span>
                <div className="space-y-1">
                  {step.tool_calls.map((tc, idx) => (
                    <div
                      key={idx}
                      className="rounded-md bg-muted/30 p-2 font-mono text-xs leading-relaxed"
                    >
                      {tc}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 结果 */}
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('trajectory.result')}
              </span>
              <div className="rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                {step.result}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ─── Loading Skeleton ─── */

function LoadingSkeleton({ t }: { t: ReturnType<typeof useTranslations<'models'>> }) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h1 className="text-lg font-semibold">{t('trajectory.title')}</h1>
      </div>
      <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ─── Error State ─── */

function ErrorState({
  error,
  onRetry,
  t,
}: {
  error: string
  onRetry: () => void
  t: ReturnType<typeof useTranslations<'models'>>
}) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h1 className="text-lg font-semibold">{t('trajectory.title')}</h1>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-16 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
        <p className="mb-1 text-sm font-medium">{error}</p>
        <p className="mb-4 text-xs text-muted-foreground">{t('trajectory.error')}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {t('trajectory.retry')}
        </Button>
      </div>
    </div>
  )
}

/* ─── Empty State ─── */

function EmptyState({ t }: { t: ReturnType<typeof useTranslations<'models'>> }) {
  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h1 className="text-lg font-semibold">{t('trajectory.title')}</h1>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-16 text-center">
        <Activity className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('trajectory.noData')}</p>
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

export default function TrajectoryPage() {
  const t = useTranslations('models')
  const [search, setSearch] = React.useState('')
  const [expandedSessionId, setExpandedSessionId] = React.useState<string | null>(null)

  // 获取轨迹列表
  const {
    data: traces,
    isLoading: listLoading,
    isError: listError,
    error: listErr,
    refetch: refetchList,
  } = useQuery<TraceItem[]>({
    queryKey: ['agent-traces'],
    queryFn: fetchTraces,
  })

  // 获取展开的轨迹详情
  const {
    data: detailData,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useQuery<TraceDetail>({
    queryKey: ['agent-trace-detail', expandedSessionId],
    queryFn: () => fetchTraceDetail(expandedSessionId!),
    enabled: !!expandedSessionId,
  })

  const handleToggleExpand = (sessionId: string) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId))
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 px-4 py-6">
        <BackButton />

        {/* 标题 */}
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <h1 className="text-lg font-semibold">{t('trajectory.title')}</h1>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder={t('trajectory.searchPlaceholder')}
            className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* 加载态 */}
        {listLoading && <LoadingSkeleton t={t} />}

        {/* 错误态 */}
        {listError && !listLoading && (
          <ErrorState
            error={listErr?.message ?? t('trajectory.error')}
            onRetry={() => refetchList()}
            t={t}
          />
        )}

        {/* 空数据态 */}
        {!listLoading && !listError && (traces ?? []).length === 0 && <EmptyState t={t} />}

        {/* 列表区域 */}
        {!listLoading && !listError && (traces ?? []).length > 0 && (
          <div className="space-y-2">
            {traces!.map((trace) => (
              <React.Fragment key={trace.session_id}>
                <TraceCard
                  trace={trace}
                  t={t}
                  expanded={expandedSessionId === trace.session_id}
                  onToggle={() => handleToggleExpand(trace.session_id)}
                />
                {/* 展开详情 */}
                {expandedSessionId === trace.session_id && (
                  <div className="pl-2">
                    {detailLoading ? (
                      <div className="space-y-3 py-4">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                                <div className="h-16 w-full animate-pulse rounded bg-muted" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : detailData ? (
                      <TraceDetailCard detail={detailData} t={t} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
                        <p className="mb-2 text-xs text-muted-foreground">
                          {t('trajectory.error')}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => refetchDetail()}
                        >
                          <RefreshCw className="mr-1.5 h-3 w-3" />
                          {t('trajectory.retry')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}