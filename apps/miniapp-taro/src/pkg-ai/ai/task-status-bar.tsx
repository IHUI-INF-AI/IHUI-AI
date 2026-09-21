// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TaskStatusBar — miniapp-taro AI 对话输入框上方的任务进度状态条。
 *
 * 视图推导全部走共享纯函数 `deriveTaskStatusBar`(@ihui/shared/chat,跨端单一真相源),
 * 本文件只做薄渲染:不自行推导步骤数 / 百分比 / 状态;空闲(无步骤、无变更、非流式)
 * 时 derive 返回 null → 整体不挂载任何节点,零占位。
 *
 * 数据源:流式期间由 chat.tsx 的 SSE 回调写入最后一条 assistant 消息的
 * `aiCards.planSteps`(plan_updated 权威快照)与 `aiCards.toolCalls`。
 * 注:端内 ToolCallView 无 args/result(与共享 ToolCall 契约不同),无法折叠文件变更统计,
 * 因此不传 fileChanges/toolCalls 给 derive,文件行数列自然不出现 —— 不在端内伪造数据。
 */
import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import LineIcon, { type IconName } from '@/components/LineIcon'
import { useI18n } from '@/i18n'
import {
  deriveTaskStatusBar,
  type TaskStatusKind,
  type TaskStatusStepView,
} from '@ihui/shared/chat'
import type { PlanStep, PlanStepStatus } from '@ihui/types'
import type { AICardsData, PlanStepView, ToolCallView } from './cards/types'
import './task-status-bar.css'

export interface TaskStatusBarProps {
  /** 最后一条 assistant 消息的 aiCards(SSE 事件累积写入;undefined = 尚无卡片数据) */
  cards?: AICardsData
  /** 流式标志(本页 thinking 状态):流式默认展开、结束自动收起 */
  isStreaming: boolean
}

/** 整体态势图标(LineIcon 现有图标库内取材,禁止 emoji 顶替) */
const KIND_ICON: Record<TaskStatusKind, IconName> = {
  running: 'zap',
  completed: 'check',
  failed: 'x',
  interrupted: 'pause',
  idle: 'circle',
}

/** 整体态势颜色(全部走 design token,深浅色自动适配) */
const KIND_COLOR: Record<TaskStatusKind, string> = {
  running: 'var(--color-brand)',
  completed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  interrupted: 'var(--color-warning-amber)',
  idle: 'var(--color-muted-foreground)',
}

const STEP_ICON: Record<PlanStepStatus, IconName> = {
  pending: 'circle',
  in_progress: 'zap',
  completed: 'check',
  failed: 'x',
  skipped: 'circle',
}

const STEP_COLOR: Record<PlanStepStatus, string> = {
  pending: 'var(--color-text-tertiary)',
  in_progress: 'var(--color-brand)',
  completed: 'var(--color-success)',
  failed: 'var(--color-danger)',
  skipped: 'var(--color-text-tertiary)',
}

/** PlanStepView → 共享 PlanStep 显式适配(id 缺失补 `step-<idx>`) */
function toPlanSteps(viewSteps: readonly PlanStepView[]): PlanStep[] {
  return viewSteps.map((p, i) => ({
    id: p.id || `step-${i}`,
    step: p.step,
    status: p.status,
    explanation: p.explanation,
    durationMs: p.durationMs,
    error: p.error,
  }))
}

export default function TaskStatusBar({ cards, isStreaming }: TaskStatusBarProps) {
  const { t } = useI18n()
  // null = 用户未干预,跟随流式状态自动展开/收起(点整条切换明细)
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? isStreaming

  const planSteps = useMemo<PlanStep[]>(() => toPlanSteps(cards?.planSteps ?? []), [cards])

  // 端侧"当前在做什么":最近一个 running 工具调用名本地化为标题(不自行造状态)
  const currentTaskLabel = useMemo<string | undefined>(() => {
    const calls = cards?.toolCalls ?? []
    for (let i = calls.length - 1; i >= 0; i--) {
      const call: ToolCallView | undefined = calls[i]
      if (call?.status === 'running') return t('taskStatus.activityTool', { tool: call.name })
    }
    return undefined
  }, [cards, t])

  const view = useMemo(
    () => deriveTaskStatusBar({ planSteps, isStreaming, currentTaskLabel }),
    [planSteps, isStreaming, currentTaskLabel],
  )

  if (!view) return null

  return (
    <View
      className="task-status-bar"
      data-testid="task-status-bar"
      data-kind={view.kind}
      data-expanded={open ? 'true' : 'false'}
    >
      <View
        className={view.active ? 'task-status-bar-card is-active' : 'task-status-bar-card'}
        hoverClass="tsb-hover"
        onClick={() => setUserOpen(!open)}
      >
        <View className="task-status-bar-row">
          <LineIcon
            name={KIND_ICON[view.kind]}
            size={28}
            color={KIND_COLOR[view.kind]}
            className={view.active ? 'tsb-spin' : undefined}
          />
          <Text className="task-status-bar-headline">
            {view.headline || t('taskStatus.waiting')}
          </Text>
          <Text className="task-status-bar-meta">
            {view.stepTotal > 0
              ? t('taskStatus.steps', { current: view.stepCurrent, total: view.stepTotal })
              : t('taskStatus.idle')}
          </Text>
          {view.changedFiles > 0 ? (
            <Text className="task-status-bar-meta">
              {t('taskStatus.filesChanged', { n: view.changedFiles })}
            </Text>
          ) : null}
          {view.linesKnown && view.changedFiles > 0 ? (
            <Text className="task-status-bar-meta">
              <Text className="tsb-lines-added">+{view.addedLines}</Text>{' '}
              <Text className="tsb-lines-removed">-{view.removedLines}</Text>
            </Text>
          ) : null}
          <View className={open ? 'tsb-caret is-open' : 'tsb-caret'} />
        </View>
        {open && view.steps.length > 0 ? (
          <View className="task-status-bar-steps">
            {view.steps.map((step: TaskStatusStepView) => (
              <View key={step.id} className={`task-status-step is-${step.status}`}>
                <LineIcon
                  name={STEP_ICON[step.status]}
                  size={24}
                  color={STEP_COLOR[step.status]}
                  className={step.status === 'in_progress' ? 'tsb-spin' : undefined}
                />
                <Text className="task-status-step-title">{step.title}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
