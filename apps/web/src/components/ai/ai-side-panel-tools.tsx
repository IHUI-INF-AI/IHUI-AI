// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  getAgentTokenUsage,
  getModelPriceCny,
  type AgentTokenUsageSummary,
  type ModelPriceCny,
} from '@ihui/api-client'
import type { FileNode } from '@ihui/types'
import {
  listCheckpoints,
  restoreCheckpoint,
  type CheckpointScope,
  type CheckpointMeta,
} from '@/api/checkpoint-api'
import { useChatStore } from '@/stores/chat'
import { useAiToolsPanelStore } from '@/stores/ai-tools-panel'
// D52(2026-09-24 立):任务监控分区面板——在既有 tab 体系之上做分组层,不新建第二套 Tab
import { TaskMonitorZonesView } from '@/components/ai/task-monitor-sections'
import { useTaskMonitorStore } from '@/stores/task-monitor'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import {
  useActiveDispatches,
  useCancelDispatch,
  useSwarmTopology,
} from '@/hooks/use-subagent-dispatch'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'

// W10 孤儿组件总接线(2026-09-13 立):以下组件均已建未接线,本容器 tab 化统一挂载。
import { PlanReviewPanel } from '@/components/ai/plan-review-panel'
import { TaskListPanel } from '@/components/ai/task-list-panel'
import { AgentProgressPanel } from '@/components/ai/agent-progress-panel'
import { AgentManager, type AgentItem } from '@/components/ai/agent-manager'
import { AgentPill } from '@/components/ai/agent-pill'
import { BackgroundAgentsPanel } from '@/components/ai/background-agents-panel'
import { AgentSwarmMonitor } from '@/components/ai/agent-swarm-monitor'
import { OrchestrationHubPanel } from '@/components/ai/orchestration-hub-panel'
import { RoutinesPanel } from '@/components/ai/routines-panel'
import { AgentTraceViewer } from '@/components/ai/AgentTraceViewer'
import { CheckpointHistoryPanel } from '@/components/ai/checkpoint-history-panel'
import { BestOfCompare } from '@/components/ai/best-of-compare'
// P3 #41(2026-09-16 立):记忆图谱可视化
import { MemoryGraphPanel } from '@/components/ai/memory-graph-panel'
import { AtomicRollbackPanel } from '@/components/ai/atomic-rollback-panel'
import { WorldsCompare } from '@/components/ai/worlds-compare'
import { AgentTasksPanel } from '@/components/ai/agent-tasks-panel'
// D25(2026-09-19 立):统一任务运行时看板(四源聚合+搜索/启动/停止/改名+@任务消息)
import { UnifiedTaskDashboard } from '@/components/agents/UnifiedTaskDashboard'
// D6 #2(2026-09-19 立):挂载 DB 持久化 + SSE 的 KanbanBoard,作为统一 agent 任务数据层
import { KanbanBoard } from '@/components/agents/KanbanBoard'
import { GoalCard } from '@/components/ai/goal-card'
import { MemoryCards } from '@/components/ai/memory-cards'
import { TokenUsagePanel } from '@/components/ai/token-usage-panel'
import { SpecPanel } from '@/components/ai/spec-panel'
import { AgentRuntimePanel } from '@/components/ai/agent-runtime-panel'
import { AgentHooksPanel } from '@/components/ai/agent-hooks-panel'
import { RepoWikiPanel } from '@/components/ai/repo-wiki-panel'
import { IntegrationsPanel } from '@/components/ai/integrations-panel'
import { WorkspaceFolderSelector } from '@/components/ai/workspace-folder-selector'
import { DispatchSubagentDialog } from '@/components/ai/dispatch-subagent-dialog'
import type { BackgroundAgent, SwarmData } from '@/components/ai/types'
import type { SubagentDispatch } from '@ihui/shared/subagents'

/** Trace 面板数据由本地消息派生(AgentTraceViewer 契约) */
interface TraceData {
  session_id: string
  success: boolean
  final_response: string
  iterations: Array<{
    iteration: number
    reasoning: string
    tool_calls: Array<{ id: string; name: string; args: Record<string, unknown> }>
    tool_results: Array<{ name: string; error?: string }>
    duration_ms: number
  }>
  total_duration_ms: number
  stop_reason: string
}

/** Trace 组件独立声明了同构接口,此处用最小结构注入 */
type TraceViewerProps = React.ComponentProps<typeof AgentTraceViewer>

export type ToolTabKey =
  | 'goal'
  | 'memory'
  | 'plan'
  | 'tasks'
  | 'progress'
  | 'agents'
  | 'background'
  | 'swarm'
  | 'orchestration'
  | 'routines'
  | 'trace'
  | 'checkpoints'
  | 'tokens'
  | 'spec'
  | 'runtime'
  | 'bestof'
  | 'memorygraph'
  | 'atomicrollback'
  | 'worlds'
  | 'agenttasks'
  | 'unified'
  | 'kanban'
  | 'hooks'
  | 'wiki'
  | 'integrations'
  | 'workspace'

const TAB_KEYS: ToolTabKey[] = [
  'goal',
  'memory',
  'plan',
  'tasks',
  'progress',
  'agents',
  'background',
  'swarm',
  'orchestration',
  'routines',
  'trace',
  'checkpoints',
  'tokens',
  'spec',
  'runtime',
  'bestof',
  'memorygraph',
  'atomicrollback',
  'worlds',
  'agenttasks',
  'unified',
  'kanban',
  'hooks',
  'wiki',
  'integrations',
  'workspace',
]

/** routines 本地持久化键(无后端 API,localStorage 兜底) */
const ROUTINES_STORAGE_KEY = 'ihui:ai-tools-routines'

/** 树中递归查找节点(WorkspacePanelTab 用) */
function findFolderNode(nodes: FileNode[], id: string): FileNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findFolderNode(n.children, id)
      if (found) return found
    }
  }
  return null
}

/** Workspace 文件夹选择面板(2026-09-14 接线 WorkspaceFolderSelector 孤儿组件,规划 5.5):
 *  展示 IDE 工作区文件树,选中文件夹后以 #Folder 引用写入输入框草稿 */
function WorkspacePanelTab() {
  const t = useTranslations('workspacePanel')
  const fileTree = useIDEWorkspace((s) => s.fileTree)
  const fetchFileTree = useIDEWorkspace((s) => s.fetchFileTree)
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (fileTree.length === 0) void fetchFileTree()
  }, [fileTree.length, fetchFileTree])

  const folders = React.useMemo(() => fileTree.filter((n) => n.type !== 'file'), [fileTree])
  const selectedNode = selected ? findFolderNode(folders, selected) : null

  const handleApply = () => {
    if (!selectedNode) return
    useChatStore.setState({ draftInput: `#Folder ${selectedNode.path}` })
    toast.success(t('applied'))
  }

  return (
    <div className="flex flex-col gap-2" data-testid="workspace-panel">
      <WorkspaceFolderSelector
        folders={folders}
        selected={selected ?? undefined}
        onSelect={setSelected}
      />
      <button
        type="button"
        data-testid="workspace-folder-apply"
        disabled={!selectedNode}
        onClick={handleApply}
        className={cn(
          'inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors',
          selectedNode
            ? 'bg-cta text-cta-foreground hover:bg-cta/90'
            : 'cursor-not-allowed bg-muted text-muted-foreground/50',
        )}
      >
        {t('apply')}
      </button>
      <p className="text-[10px] text-muted-foreground">{t('hint')}</p>
    </div>
  )
}

interface StoredRoutine {
  id: string
  name: string
  schedule: string
  enabled: boolean
  lastRun?: string
}

function loadRoutines(): StoredRoutine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(ROUTINES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredRoutine[]) : []
  } catch {
    return []
  }
}

function saveRoutines(routines: StoredRoutine[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ROUTINES_STORAGE_KEY, JSON.stringify(routines))
  } catch {
    // 忽略持久化失败(隐私模式等)
  }
}

/** 派单状态 → AgentItem 状态映射 */
function dispatchToAgentStatus(d: SubagentDispatch): AgentItem['status'] {
  if (d.status === 'completed') return 'done'
  if (d.status === 'failed' || d.status === 'cancelled') return 'error'
  return 'running'
}

/** 派单状态 → BackgroundAgent 状态映射 */
function dispatchToBgStatus(d: SubagentDispatch): BackgroundAgent['status'] {
  if (d.status === 'completed') return 'completed'
  if (d.status === 'failed') return 'failed'
  if (d.status === 'cancelled') return 'cancelled'
  return 'running'
}

/**
 * AiSidePanelTools — AI 面板 tab 化工具面板(W10 孤儿组件总接线)。
 *
 * 在消息区与输入区之间提供可折叠工具托盘,tab 化挂载 15 个已建未接线的组件:
 *  - plan / tasks:由最近一条携带 planSteps 的消息派生(SSE plan 事件写入)
 *  - progress:由 subAgentActivities 派生(子代理活动流)
 *  - agents:useActiveDispatches 派发列表 + AgentPill 状态摘要 + 派发对话框入口
 *  - background:派发列表映射 BackgroundAgent(取消/刷新)
 *  - swarm:useSwarmTopology 拓扑映射 SwarmData
 *  - orchestration:编排中心(自取数据)
 *  - trace:由最近一条带 toolCalls 的 assistant 消息派生执行轨迹
 *  - checkpoints:GET /api/checkpoints(会话级)+ restore
 *  - tokens:GET /api/agents/{id}/usage + 真网计价(同 SessionUsageBadge 口径)
 *  - spec / runtime:自包含面板直接挂载
 */
export function AiSidePanelTools() {
  const t = useTranslations('aiToolsPanel')
  // D52:任务监控分区文案(「展示方式」/ 四区名)
  const tm = useTranslations('taskMonitor')
  const open = useAiToolsPanelStore((s) => s.open)
  const [activeTab, setActiveTab] = React.useState<ToolTabKey>('plan')
  // D52:展示方式(sections 分区视图默认 / tabs 平铺旧行为),persist 持久化
  const displayMode = useTaskMonitorStore((s) => s.displayMode)
  const setDisplayMode = useTaskMonitorStore((s) => s.setDisplayMode)

  // chat store 数据源
  const messages = useChatStore((s) => s.messages)
  const subAgentActivities = useChatStore((s) => s.subAgentActivities)
  const conversationId = useChatStore((s) => s.conversationId)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const currentModel = useChatStore((s) => s.currentModel)

  // ---- plan / tasks:最近一条携带 planSteps 的消息 ----
  const latestPlan = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (!m) continue
      if (m.planSteps && m.planSteps.length > 0) return m.planSteps
    }
    return []
  }, [messages])

  // ---- progress:子代理活动 → ProgressStep[] ----
  const progressSteps = React.useMemo(() => {
    const steps: Array<{
      id: string
      title: string
      status: 'pending' | 'running' | 'done' | 'error'
    }> = []
    for (const a of subAgentActivities) {
      a.completedSteps.forEach((s, i) => {
        steps.push({
          id: `${a.agentId}-${i}`,
          title: `${a.name}: ${s.stepAction}`,
          status: s.status === 'failed' ? 'error' : 'done',
        })
      })
      if (a.currentStep) {
        steps.push({
          id: `${a.agentId}-current`,
          title: `${a.name}: ${a.currentStep}`,
          status: 'running',
        })
      }
    }
    return steps
  }, [subAgentActivities])

  // ---- agents / background:活跃派单列表 ----
  const activeDispatches = useActiveDispatches()
  const cancelDispatch = useCancelDispatch()
  const [dispatchOpen, setDispatchOpen] = React.useState(false)
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | undefined>(undefined)

  const dispatches = React.useMemo(() => activeDispatches.data ?? [], [activeDispatches.data])
  const agentItems = React.useMemo<AgentItem[]>(
    () =>
      dispatches.map((d) => ({
        id: d.id,
        name: d.agentRole ?? d.goal.slice(0, 24),
        role: d.agentRole ?? 'researcher',
        status: dispatchToAgentStatus(d),
      })),
    [dispatches],
  )

  const bgAgents = React.useMemo<BackgroundAgent[]>(
    () =>
      dispatches.map((d) => ({
        agent_id: d.id,
        status: dispatchToBgStatus(d),
        prompt: d.goal,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
        result: d.result ? { output: d.result } : undefined,
        error: d.errorMessage,
      })),
    [dispatches],
  )

  // ---- swarm:拓扑 → SwarmData ----
  const topology = useSwarmTopology()
  const swarmData = React.useMemo<SwarmData | null>(() => {
    const nodes = topology.data?.nodes ?? []
    if (nodes.length === 0) return null
    return {
      agentList: nodes.map((n) => ({
        name: n.label,
        type: n.role,
        status:
          n.status === 'completed'
            ? 'completed'
            : n.status === 'failed'
              ? 'failed'
              : n.status === 'running'
                ? 'acting'
                : 'idle',
      })),
    }
  }, [topology.data])

  // ---- trace:最近一条带 toolCalls 的 assistant 消息 ----
  const trace = React.useMemo<TraceData | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (!m) continue
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const calls = m.toolCalls
        const totalMs = calls.reduce((sum, c) => sum + (c.durationMs ?? 0), 0)
        return {
          session_id: conversationId ?? 'current',
          success: !m.error,
          final_response: typeof m.content === 'string' ? m.content : '',
          iterations: [
            {
              iteration: 1,
              reasoning: '',
              tool_calls: calls.map((c) => ({
                id: c.id,
                name: c.toolName,
                args: (c.args ?? {}) as Record<string, unknown>,
              })),
              tool_results: calls.map((c) => ({
                name: c.toolName,
                error: c.status === 'error' ? (c.error ?? '执行失败') : undefined,
              })),
              duration_ms: totalMs,
            },
          ],
          total_duration_ms: totalMs,
          stop_reason: m.error ? 'error' : 'completed',
        }
      }
    }
    return null
  }, [messages, conversationId])

  // ---- checkpoints:会话级检查点(tab 激活时拉取) ----
  const [checkpoints, setCheckpoints] = React.useState<CheckpointMeta[]>([])
  const [checkpointsLoading, setCheckpointsLoading] = React.useState(false)

  const refreshCheckpoints = React.useCallback(async (sessionId: string) => {
    setCheckpointsLoading(true)
    try {
      const r = await listCheckpoints(sessionId)
      setCheckpoints(r.checkpoints)
    } catch {
      setCheckpoints([])
    } finally {
      setCheckpointsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!open || activeTab !== 'checkpoints' || !conversationId) return
    void refreshCheckpoints(conversationId)
  }, [open, activeTab, conversationId, refreshCheckpoints])

  const handleRestoreCheckpoint = React.useCallback(
    async (id: string, scope: CheckpointScope = 'both') => {
      if (!conversationId) return
      try {
        await restoreCheckpoint(id, conversationId, scope)
        toast.success(t('checkpointRestored'))
        void refreshCheckpoints(conversationId)
      } catch (e) {
        toast.error(t('restoreFailed'), {
          description: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [conversationId, refreshCheckpoints, t],
  )

  // ---- tokens:会话累计用量 + 真网计价(同 SessionUsageBadge 口径) ----
  const [usage, setUsage] = React.useState<AgentTokenUsageSummary | null>(null)
  const [price, setPrice] = React.useState<ModelPriceCny | null>(null)

  const refreshUsage = React.useCallback(async (id: string) => {
    try {
      const summary = await getAgentTokenUsage(id)
      setUsage(summary.totalTokens > 0 ? summary : null)
    } catch {
      setUsage(null)
    }
  }, [])

  React.useEffect(() => {
    if (!conversationId) {
      setUsage(null)
      return
    }
    void refreshUsage(conversationId)
  }, [conversationId, refreshUsage])

  // 流式结束(true→false)后刷新(SSE 流内无 usage 事件)
  const prevStreamingRef = React.useRef(isStreaming)
  React.useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && conversationId) {
      void refreshUsage(conversationId)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming, conversationId, refreshUsage])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await getModelPriceCny(currentModel ?? '')
        if (!cancelled) setPrice(p)
      } catch {
        if (!cancelled) setPrice(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentModel])

  const tokenCost =
    price && usage
      ? (usage.promptTokens / 1000) * price.inputPricePer1kCny +
        (usage.completionTokens / 1000) * price.outputPricePer1kCny
      : undefined

  // ---- routines:localStorage 持久化 ----
  const [routines, setRoutines] = React.useState<StoredRoutine[]>(loadRoutines)

  const handleRoutineToggle = React.useCallback((id: string) => {
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
      saveRoutines(next)
      return next
    })
  }, [])

  const handleRoutineRun = React.useCallback((id: string) => {
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, lastRun: new Date().toISOString() } : r))
      saveRoutines(next)
      return next
    })
  }, [])

  // ---- tab 内容渲染 ----
  const emptyHint = <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>

  const renderTab = (key: ToolTabKey) => {
    switch (key) {
      case 'goal':
        return <GoalCard />
      case 'memory':
        return <MemoryCards />
      case 'plan':
        return latestPlan.length > 0 ? (
          <PlanReviewPanel
            plan={{ steps: latestPlan.map((s) => ({ id: s.id, description: s.step })) }}
          />
        ) : (
          emptyHint
        )
      case 'tasks':
        return latestPlan.length > 0 ? (
          <TaskListPanel
            tasks={latestPlan.map((s) => ({
              id: s.id,
              title: s.step,
              status:
                s.status === 'in_progress'
                  ? 'in-progress'
                  : s.status === 'completed'
                    ? 'done'
                    : 'todo',
            }))}
          />
        ) : (
          emptyHint
        )
      case 'progress':
        return progressSteps.length > 0 ? <AgentProgressPanel steps={progressSteps} /> : emptyHint
      case 'agents':
        return (
          <div className="space-y-3">
            {dispatches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {dispatches.map((d) => (
                  <AgentPill
                    key={d.id}
                    name={d.agentRole ?? 'agent'}
                    status={
                      d.status === 'completed'
                        ? 'done'
                        : d.status === 'failed' || d.status === 'cancelled'
                          ? 'error'
                          : 'running'
                    }
                    active={selectedAgentId === d.id}
                    onClick={() => setSelectedAgentId(d.id)}
                  />
                ))}
              </div>
            )}
            {agentItems.length > 0 ? (
              <AgentManager
                agents={agentItems}
                selectedId={selectedAgentId}
                onSelect={setSelectedAgentId}
              />
            ) : (
              emptyHint
            )}
            <button
              type="button"
              data-testid="ai-tools-dispatch-subagent"
              onClick={() => setDispatchOpen(true)}
              className="w-full rounded-md bg-cta px-3 py-2 text-sm font-medium text-cta-foreground transition-colors hover:bg-cta/90"
            >
              {t('dispatchSubagent')}
            </button>
          </div>
        )
      case 'background':
        return bgAgents.length > 0 ? (
          <BackgroundAgentsPanel
            agents={bgAgents}
            loading={activeDispatches.isFetching}
            onRefresh={() => void activeDispatches.refetch()}
            onCancel={(id) => cancelDispatch.mutateAsync(id)}
          />
        ) : (
          emptyHint
        )
      // D6 第 2 步(half-merge 占位):swarm 入口收敛说明。
      // 完整归并目标:把 AgentSwarmMonitor + SwarmTopologyView 并入 OrchestrationHubPanel
      // 的 subagents tab(统一多 agent 拓扑视图)。但因 agent-swarm-monitor.tsx 本轮被占用
      // 禁改,此处仅保留 swarm tab 入口 + 收敛注释,完整归并待占用解除后由主会话执行。
      case 'swarm':
        return swarmData ? (
          <AgentSwarmMonitor
            swarmData={swarmData}
            loading={topology.isFetching}
            onRefresh={() => void topology.refetch()}
          />
        ) : (
          emptyHint
        )
      case 'orchestration':
        return <OrchestrationHubPanel />
      case 'routines':
        return (
          <RoutinesPanel
            routines={routines}
            onToggle={handleRoutineToggle}
            onRun={handleRoutineRun}
          />
        )
      case 'trace':
        return trace ? <AgentTraceViewer {...({ trace } as TraceViewerProps)} /> : emptyHint
      case 'checkpoints':
        return checkpointsLoading ? (
          emptyHint
        ) : checkpoints.length > 0 ? (
          <CheckpointHistoryPanel
            checkpoints={checkpoints.map((c) => ({
              id: c.checkpoint_id,
              label: `#${c.iteration} · ${c.message_count} msgs`,
              timestamp: new Date(c.created_at).toISOString(),
            }))}
            sessionId={conversationId ?? ''}
            onRestore={(id, scope) => void handleRestoreCheckpoint(id, scope)}
          />
        ) : (
          emptyHint
        )
      case 'tokens':
        return usage ? (
          <TokenUsagePanel
            promptTokens={usage.promptTokens}
            completionTokens={usage.completionTokens}
            totalTokens={usage.totalTokens}
            cost={tokenCost}
            model={currentModel ?? undefined}
          />
        ) : (
          emptyHint
        )
      case 'spec':
        return <SpecPanel />
      case 'runtime':
        return <AgentRuntimePanel />
      case 'bestof':
        return (
          <BestOfCompare
            onAdopt={(content) => {
              // W23 落盘:把选中候选写入会话消息流(本地 assistant 消息)
              useChatStore.getState().addMessage({
                role: 'assistant',
                content,
                model: currentModel ?? undefined,
              })
              toast.success(t('bestOfAdopted'))
            }}
          />
        )
      // P3 #41 记忆图谱(2026-09-16 立):子图可视化
      case 'memorygraph':
        return <MemoryGraphPanel />
      // P3 #42 全栈原子回滚(2026-09-17 立):dry-run 预演 + confirm 执行
      case 'atomicrollback':
        return <AtomicRollbackPanel />
      // P3 #38 并行世界线(2026-09-17 落地):fork 并行 + 并排对比 + 择优采纳
      case 'worlds':
        return (
          <WorldsCompare
            currentModel={currentModel ?? undefined}
            onAdopt={(content, model) => {
              // 复用 #36 落盘模式:采纳内容写入会话消息流
              useChatStore.getState().addMessage({
                role: 'assistant',
                content,
                model,
              })
              toast.success(t('worldsAdopted'))
            }}
          />
        )
      // P3 #44 阶段3 前端宿主(2026-09-17 立):agent 运行任务列表 + 中途插话
      case 'agenttasks':
        return <AgentTasksPanel />
      // D25(2026-09-19 立):统一任务运行时看板(四源聚合:kanban/后台派单/本地 agentLoop/云端运行)
      case 'unified':
        return <UnifiedTaskDashboard />
      // D6 第 2 步(2026-09-19 立):挂载 DB 持久化 + SSE 的 KanbanBoard,作为统一 agent 任务数据层
      case 'kanban':
        return <KanbanBoard />
      // W28 Hooks 事件系统配置面板(2026-09-14 立)
      case 'hooks':
        return <AgentHooksPanel />
      // W29 Repo Wiki / 知识卡片面板(2026-09-14 立)
      case 'wiki':
        return <RepoWikiPanel />
      // W30 多入口集成面板(2026-09-14 立)
      case 'integrations':
        return <IntegrationsPanel />
      // Workspace 文件夹选择面板(2026-09-14 接线孤儿组件,规划 5.5)
      case 'workspace':
        return <WorkspacePanelTab />
      default:
        return emptyHint
    }
  }

  return (
    <div data-testid="ai-side-panel-tools" className={open ? 'border-t' : 'hidden'}>
      {/* 派发子代理对话框(agents tab 触发) */}
      <DispatchSubagentDialog open={dispatchOpen} onOpenChange={setDispatchOpen} />

      {open && (
        <>
          {/* 展示方式切换器(D52):紧凑胶囊,sections 分区视图(默认)/ tabs 平铺旧行为 */}
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <span className="text-[10px] text-muted-foreground">{tm('displayMode')}</span>
            <div
              role="group"
              data-testid="task-monitor-display-mode"
              className="flex items-center rounded-full bg-muted p-0.5"
            >
              {(['sections', 'tabs'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  data-testid={`task-monitor-mode-${mode}`}
                  aria-pressed={displayMode === mode}
                  onClick={() => setDisplayMode(mode)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[11px] transition-colors',
                    displayMode === mode
                      ? 'bg-background font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tm(mode === 'sections' ? 'modeSections' : 'modeTabs')}
                </button>
              ))}
            </div>
          </div>

          {displayMode === 'sections' ? (
            /* 分区视图(D52):四区分组层,激活 Tab 逻辑与 renderTab 全部复用既有实现 */
            <TaskMonitorZonesView
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              renderTab={renderTab}
            />
          ) : (
            <>
              {/* tab 导航条(横向滚动) */}
              <div
                role="tablist"
                aria-label={t('title')}
                className="flex gap-1 overflow-x-auto border-b px-2 pb-1.5"
              >
                {TAB_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    id={`ai-tools-tab-${key}`}
                    aria-selected={activeTab === key}
                    aria-controls={`ai-tools-panel-${key}`}
                    data-testid={`ai-panel-tab-${key}`}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors',
                      activeTab === key
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                    )}
                  >
                    {t(`tabs.${key}`)}
                  </button>
                ))}
              </div>

              {/* tab 内容区 */}
              <div
                role="tabpanel"
                id={`ai-tools-panel-${activeTab}`}
                aria-labelledby={`ai-tools-tab-${activeTab}`}
                data-testid={`ai-panel-content-${activeTab}`}
                className="max-h-80 overflow-y-auto p-3"
              >
                {renderTab(activeTab)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
