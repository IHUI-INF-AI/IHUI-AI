// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Network } from 'lucide-react'

import {
  getSubagentDispatchStats,
  type SubagentDispatch,
  type SubagentDispatchStats,
} from '@ihui/api-client'
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { SwarmTopologyView } from '@/components/ai/swarm-topology-view'
import type { AgentStatus, SubAgentActivity } from '@/components/ai/types'
import { formatNumber } from '@/lib/date-utils'

/** DispatchStatus → AgentStatus(活动流卡片状态映射) */
function dispatchStatusToAgentStatus(status: string): AgentStatus {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'failed':
      return 'failed'
    case 'cancelled':
      return 'cancelled'
    case 'pending':
      return 'pending'
    case 'paused':
      return 'waiting'
    default:
      return 'running'
  }
}

/** 派单 → 活动流条目(v1 读侧:单卡片呈现目标/角色/状态/结果或错误) */
function dispatchToActivity(d: SubagentDispatch): SubAgentActivity {
  return {
    agentId: d.id,
    name: d.goal.slice(0, 80) || d.id,
    type: d.agentRole ?? 'subagent',
    status: dispatchStatusToAgentStatus(d.status),
    currentStep: d.errorMessage || d.result?.slice(0, 200) || '',
    completedSteps: [],
  }
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  )
}

export interface RunDetailProps {
  dispatch: SubagentDispatch
}

/** 运行详情(读侧):派单元信息 + 资源统计 + 成员角色活动流 + Swarm 拓扑 */
export function RunDetail({ dispatch }: RunDetailProps) {
  const t = useTranslations('agentTeams')
  const [stats, setStats] = React.useState<SubagentDispatchStats | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setStats(null)
    getSubagentDispatchStats(dispatch.id)
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {
        // 单派单统计缺失不阻塞详情页
      })
    return () => {
      cancelled = true
    }
  }, [dispatch.id])

  const activity = React.useMemo(() => dispatchToActivity(dispatch), [dispatch])

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="rounded-xl border p-3">
        <h2 className="mb-3 text-sm font-semibold">{t('detailTitle')}</h2>
        <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-3">
          <MetaRow label={t('goal')} value={dispatch.goal || '-'} />
          <MetaRow label={t('role')} value={dispatch.agentRole ?? t('none')} />
          <MetaRow label={t('orchestration')} value={dispatch.orchestration ?? t('none')} />
          <MetaRow label={t('priority')} value={dispatch.priority ?? t('none')} />
          <MetaRow label={t('createdAt')} value={dispatch.createdAt} />
          <MetaRow label={t('updatedAt')} value={dispatch.updatedAt} />
          {dispatch.result && <MetaRow label={t('result')} value={dispatch.result} />}
          {dispatch.errorMessage && <MetaRow label={t('error')} value={dispatch.errorMessage} />}
          {stats && (
            <>
              <MetaRow
                label={t('tokens')}
                value={formatNumber(Number(stats.totalTokens ?? stats.tokensUsed ?? 0))}
              />
              <MetaRow
                label={t('durationMs')}
                value={formatNumber(Number(stats.totalDurationMs ?? stats.durationMs ?? 0))}
              />
            </>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Network className="h-3.5 w-3.5" aria-hidden="true" />
          {t('topologyTitle')}
        </h3>
        <SwarmTopologyView />
      </div>

      <div>
        <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t('activityTitle')}</h3>
        <SubAgentActivityFeed
          swarmId={dispatch.id}
          activities={[activity]}
          completed={dispatch.status === 'completed'}
        />
      </div>
    </div>
  )
}

export default RunDetail
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
