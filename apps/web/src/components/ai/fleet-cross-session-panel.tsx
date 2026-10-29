// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, UsersRound } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import {
  getAllSubagentDispatches,
  getSubagentStats,
  type SubagentDispatch,
  type SubagentGlobalStats,
} from '@ihui/api-client'
import { BackgroundAgentsPanel } from './background-agents-panel'
import { useBackgroundAgentNotify } from '@/hooks/use-background-agent-notify'
import type { BackgroundAgent } from './types'

/**
 * FleetCrossSessionPanel — D08 ③「Fleet 统一仪表盘」最小可用面(2026-10-27)。
 *
 * background-agents-panel 是本会话侧栏里的单会话视角;本组件把视角扩到**跨会话**:
 * 数据源 = GET /api/subagents/all(全量派单,含终态,新→旧),按状态分桶展示,
 * 每桶头带计数徽章;token 总量取 GET /api/subagents/stats。
 * 行渲染(八态徽章/停止通道/截断报数)整块复用 BackgroundAgentsPanel,
 * 状态→色/图标/动作判据仍唯一来自 @ihui/shared/chat/element-pack,本文件零复写。
 * 票面硬约束:不新建 SSE 帧族、不做实时推送 —— 刷新一律手动按钮触发。
 */

/** 状态分桶(与 agent-teams 页 FILTER_STATUS_SET 同族口径;pending/paused 归运行中桶) */
const STATUS_BUCKETS = [
  { key: 'running', labelKey: 'filter.running', statuses: ['pending', 'running', 'paused'] },
  { key: 'completed', labelKey: 'filter.completed', statuses: ['completed'] },
  { key: 'failed', labelKey: 'filter.failed', statuses: ['failed', 'cancelled'] },
] as const

/** 派单状态 → BackgroundAgent.status 契约适配(仅数据形状归一,非展示判据;渲染态归并由判定层 fromAgentStatus 负责) */
function toBackgroundAgent(d: SubagentDispatch): BackgroundAgent {
  const status: BackgroundAgent['status'] =
    d.status === 'completed'
      ? 'completed'
      : d.status === 'failed'
        ? 'failed'
        : d.status === 'cancelled'
          ? 'cancelled'
          : 'running'
  // D08 ③:进度/逐 agent token 只读载荷上的 metrics;缺该字段 = 未判定(不塞 0、不编造)
  const metrics = d.metrics
  const progress = metrics
    ? {
        tool_calls: metrics.steps.length,
        text_preview:
          metrics.dagTotal !== undefined && metrics.dagDone !== undefined
            ? `${metrics.dagDone}/${metrics.dagTotal}`
            : undefined,
      }
    : undefined
  return {
    agent_id: d.id,
    status,
    prompt: d.goal,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    progress,
    result: d.result ? { output: d.result } : undefined,
    error: d.errorMessage,
    tokens: metrics?.totalTokens,
    // 一键接管:仅「还在跑」的派单 + 有会话归属时给入口(既有 /chat?conversationId= 深链);
    // 终态不给(用「查看结果」),未归属会话不给(不伪造入口)
    takeoverHref:
      status === 'running' && d.conversationId
        ? `/chat?conversationId=${encodeURIComponent(d.conversationId)}`
        : undefined,
  }
}

interface FleetCrossSessionPanelProps {
  /** 停止通道:沿用宿主已接好的取消 mutation(返回 void 视为已受理) */
  onCancel?: (agentId: string) => void
}

/** 计数徽章:仓内数字计数徽章模板(h-4/min-w-4/tabular-nums),禁止手搓 */
function CountBadge({ count, tone }: { count: number; tone: 'muted' | 'active' }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 items-center justify-center rounded-md px-1 text-[10px] font-semibold leading-none tabular-nums',
        tone === 'active' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground',
      )}
    >
      {count}
    </span>
  )
}

export function FleetCrossSessionPanel({ onCancel }: FleetCrossSessionPanelProps) {
  const t = useTranslations('agentTeams')
  const [dispatches, setDispatches] = React.useState<SubagentDispatch[]>([])
  const [stats, setStats] = React.useState<SubagentGlobalStats | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [allRes, statsRes] = await Promise.all([
        getAllSubagentDispatches({ limit: 200 }),
        getSubagentStats().catch(() => null),
      ])
      setDispatches(allRes.dispatches)
      setStats(statsRes)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const buckets = React.useMemo(
    () =>
      STATUS_BUCKETS.map((b) => ({
        ...b,
        agents: dispatches.filter((d) => (b.statuses as readonly string[]).includes(d.status)),
      })).filter((b) => b.agents.length > 0),
    [dispatches],
  )

  const activeCount = buckets.find((b) => b.key === 'running')?.agents.length ?? 0

  // D08 ③ 完成通知:必须在**整表**层面发一次 —— 分桶渲染时派单从「运行」桶移到「完成」桶
  // 就换了实例,逐桶调 hook 认不出 running→completed 的跳变(不是发不出,就是发两遍)。
  // 故桶内实例一律 notify={false},这里统一比对上一次全表快照。
  const allAgents = React.useMemo(() => dispatches.map(toBackgroundAgent), [dispatches])
  useBackgroundAgentNotify(allAgents)

  return (
    <div
      data-testid="fleet-cross-session-panel"
      className="overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('title')}</span>
          <CountBadge count={dispatches.length} tone="muted" />
          {activeCount > 0 && <CountBadge count={activeCount} tone="active" />}
        </div>
        <div className="flex items-center gap-2">
          {stats?.totalTokens !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('tokens')}: {stats.totalTokens}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('refresh')}
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}

      {dispatches.length === 0 && !loading && !error ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="space-y-2 px-2 py-2">
          {buckets.map((b) => (
            <section key={b.key} data-testid={`fleet-group-${b.key}`}>
              <div className="flex items-center gap-2 px-1 py-1">
                <span className="text-xs text-muted-foreground">{t(b.labelKey)}</span>
                <CountBadge
                  count={b.agents.length}
                  tone={b.key === 'running' ? 'active' : 'muted'}
                />
              </div>
              <BackgroundAgentsPanel
                agents={b.agents.map(toBackgroundAgent)}
                loading={loading}
                onCancel={onCancel}
                notify={false}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default FleetCrossSessionPanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
