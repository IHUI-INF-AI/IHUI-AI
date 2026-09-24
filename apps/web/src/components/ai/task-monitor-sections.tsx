// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import type { ToolTabKey } from './ai-side-panel-tools'

/** 任务监控四区标识(G-63 对标 Qoder「任务监控」分区原文) */
export type TaskZone = 'progress' | 'activity' | 'results' | 'auxiliary'

/**
 * 分区映射表(zone → ToolTabKey[]):D52 分组层唯一事实源。
 * 归区依据 = 逐个 Tab 读 ai-side-panel-tools.tsx renderTab 各 case 的实挂组件,非按命名猜测:
 *  - progress 进度与上下文:会话侧任务状态与长期上下文 —— goal(目标卡片)/memory(记忆卡片)/
 *    memorygraph(记忆图谱)/plan(计划)/tasks(任务列表)/unified(任务中心,四源聚合看板)/
 *    kanban(任务看板)
 *  - activity 执行活动:agent 执行过程的实时监控与留痕 —— progress(子代理活动流)/
 *    agents(代理派发+AgentManager)/background(后台代理)/swarm(集群拓扑)/
 *    orchestration(编排中心)/trace(执行轨迹)/checkpoints(检查点)/runtime(运行时)/
 *    agenttasks(agent 运行任务)/hooks(钩子事件)
 *  - results 结果与来源:产出物、对照与出处 —— bestof(择优对比)/worlds(世界线对比)/
 *    atomicrollback(整栈回滚)/tokens(token 用量)/spec(规格)/wiki(知识库来源)
 *  - auxiliary 辅助入口:配置与外围能力 —— routines(例行调度)/integrations(集成)/
 *    workspace(工作区文件夹选择)
 */
export const TASK_MONITOR_ZONES: Readonly<Record<TaskZone, readonly ToolTabKey[]>> = {
  progress: ['goal', 'memory', 'memorygraph', 'plan', 'tasks', 'unified', 'kanban'],
  activity: [
    'progress',
    'agents',
    'background',
    'swarm',
    'orchestration',
    'trace',
    'checkpoints',
    'runtime',
    'agenttasks',
    'hooks',
  ],
  results: ['bestof', 'worlds', 'atomicrollback', 'tokens', 'spec', 'wiki'],
  auxiliary: ['routines', 'integrations', 'workspace'],
}

const ZONE_ORDER: readonly TaskZone[] = ['progress', 'activity', 'results', 'auxiliary']

interface TaskMonitorZonesViewProps {
  /** 当前激活 Tab(激活逻辑与状态源全部复用 ai-side-panel-tools 现有实现) */
  activeTab: ToolTabKey
  onSelectTab: (key: ToolTabKey) => void
  /** 复用既有 renderTab,不另建第二套 Tab 体系 */
  renderTab: (key: ToolTabKey) => React.ReactNode
}

/**
 * TaskMonitorZonesView — 以任务为中心的分区视图(D52)。
 *
 * 每区一条可折叠分区:区头(区名 + 区内 Tab 数)→ 区内 Tab 子导航(role=tab,复用既有
 * id/testid 约定)→ 若激活 Tab 属于本区,在区内渲染其内容(与平铺模式同一 tabpanel 契约)。
 */
export function TaskMonitorZonesView({ activeTab, onSelectTab, renderTab }: TaskMonitorZonesViewProps) {
  const tZone = useTranslations('taskMonitor')
  const tTab = useTranslations('aiToolsPanel')
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<TaskZone>>(() => new Set())

  const toggleZone = React.useCallback((zone: TaskZone) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(zone)) {
        next.delete(zone)
      } else {
        next.add(zone)
      }
      return next
    })
  }, [])

  return (
    <div data-testid="task-monitor-zones">
      {ZONE_ORDER.map((zone) => {
        const keys = TASK_MONITOR_ZONES[zone]
        const zoneLabel = tZone(`sections.${zone}`)
        const containsActive = keys.includes(activeTab)
        // 含激活 Tab 的区始终展开,保证当前内容可见
        const expanded = containsActive || !collapsed.has(zone)
        return (
          <div
            key={zone}
            data-testid={`task-monitor-zone-${zone}`}
            className="border-b last:border-b-0"
          >
            <button
              type="button"
              aria-expanded={expanded}
              data-testid={`task-monitor-zone-toggle-${zone}`}
              onClick={() => toggleZone(zone)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-medium text-foreground/80 transition-colors hover:bg-accent/50"
            >
              <span>{zoneLabel}</span>
              <span className="text-[10px] font-normal text-muted-foreground">{keys.length}</span>
            </button>
            {expanded && (
              <>
                <div role="tablist" aria-label={zoneLabel} className="flex flex-wrap gap-1 px-3 pb-1.5">
                  {keys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`ai-tools-tab-${key}`}
                      aria-selected={activeTab === key}
                      aria-controls={`ai-tools-panel-${key}`}
                      data-testid={`ai-panel-tab-${key}`}
                      onClick={() => onSelectTab(key)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-xs transition-colors',
                        activeTab === key
                          ? 'bg-accent font-medium text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
                      )}
                    >
                      {tTab(`tabs.${key}`)}
                    </button>
                  ))}
                </div>
                {containsActive && (
                  <div
                    role="tabpanel"
                    id={`ai-tools-panel-${activeTab}`}
                    aria-labelledby={`ai-tools-tab-${activeTab}`}
                    data-testid={`ai-panel-content-${activeTab}`}
                    className="max-h-80 overflow-y-auto p-3"
                  >
                    {renderTab(activeTab)}
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
