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
 * 端内 ToolCallView 携带 args/result(SSE tool-call-start / tool-result 透传),经
 * `toSharedToolCalls` 适配成共享 ToolCall 契约后交给 derive 折叠"改了哪些文件 / ± 多少行";
 * 行数取不到时共享层给 -1、derive 以 linesKnown=false 表达 → 本端不显示 0 占位,也不伪造数据。
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
import {
  formatDeltaParts,
  localizeToolText,
  toolRowTitle,
  type TranslateFn,
} from './cards/tool-line'
import {
  toSharedToolCalls,
  type AICardsData,
  type PlanStepView,
  type ToolCallView,
} from './cards/types'
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

/** PlanStepView → 共享 PlanStep 显式适配(id 缺失补 `step-<idx>`);
 *  step/explanation 文本内的英文工具码名统一本地化为功能名(共享 tool-display 映射)。 */
function toPlanSteps(viewSteps: readonly PlanStepView[], t: TranslateFn): PlanStep[] {
  return viewSteps.map((p, i) => ({
    id: p.id || `step-${i}`,
    step: localizeToolText(p.step, t),
    status: p.status,
    explanation: p.explanation ? localizeToolText(p.explanation, t) : p.explanation,
    durationMs: p.durationMs,
    error: p.error,
  }))
}

export default function TaskStatusBar({ cards, isStreaming }: TaskStatusBarProps) {
  const { t } = useI18n()
  // null = 用户未干预,跟随流式状态自动展开/收起(点整条切换明细)
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? isStreaming

  const planSteps = useMemo<PlanStep[]>(() => toPlanSteps(cards?.planSteps ?? [], t), [cards, t])

  // 端侧"当前在做什么":最近一个 running 工具调用 → 功能名(共享映射),界面禁止直显英文码名。
  const currentTaskLabel = useMemo<string | undefined>(() => {
    const calls = cards?.toolCalls ?? []
    for (let i = calls.length - 1; i >= 0; i--) {
      const call: ToolCallView | undefined = calls[i]
      if (call?.status !== 'running') continue
      return toolRowTitle(call, t)
    }
    return undefined
  }, [cards, t])

  const view = useMemo(
    () =>
      deriveTaskStatusBar({
        planSteps,
        isStreaming,
        currentTaskLabel,
        // 写类工具的 args/result 经共享层折叠出"改了哪些文件 / ± 多少行"(与 web 同一口径)
        toolCalls: toSharedToolCalls(cards?.toolCalls ?? []),
      }),
    [planSteps, isStreaming, currentTaskLabel, cards],
  )

  if (!view) return null

  // 聚合 ± 行数:行数未知(linesKnown=false)时整段不挂载,不显示 0 占位
  const delta = formatDeltaParts(view.addedLines, view.removedLines, t)

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
            <Text className="task-status-bar-meta task-status-bar-delta">
              {delta.added ? <Text className="tsb-lines-added">{delta.added}</Text> : null}
              {delta.removed ? <Text className="tsb-lines-removed">{delta.removed}</Text> : null}
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
