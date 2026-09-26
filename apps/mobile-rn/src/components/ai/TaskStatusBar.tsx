// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * TaskStatusBar —— mobile-rn 对话屏输入框上方的任务进度状态条。
 *
 * 对齐 web `apps/web/src/components/ai/task-status-bar.tsx`:数据由 ai-service 的
 * plan_updated SSE 事件驱动(消息级 planSteps,整体替换);视图推导全部走共享纯函数
 * `deriveTaskStatusBar`(packages/shared/src/chat/task-status.ts,经 @ihui/shared
 * 根导出复用),本文件只渲染。空闲(无步骤、无变更、非流式)时返回 null,不占高度。
 *
 * 平台特有:依赖 react-native / lucide-react-native API,不适合共享。
 */
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Check, ChevronDown, ChevronUp, CircleDashed, Loader2, X } from 'lucide-react-native'
import { humanizeToolText, deriveTaskStatusBar } from '@ihui/shared'
import type { TaskStatusKind, TaskStatusStepView } from '@ihui/shared'
import type { PlanStepStatus, ToolCall } from '@ihui/types'
import { tokens } from '../../theme/active-tokens'
import { useI18n } from '../../i18n'
import type { PlanStepItem, ToolCallItem } from '../../utils/chat-render-model'

export interface TaskStatusBarProps {
  /** 最后一条带 planSteps 的 assistant 消息的步骤快照(plan_updated 权威整体替换) */
  planSteps: readonly PlanStepItem[]
  /** 同消息级 toolCalls(由共享层折叠出文件变更统计) */
  toolCalls?: readonly ToolCallItem[]
  /** 流式标志(本屏 sending state) */
  isStreaming: boolean
}

type StatusGlyph = { icon: 'check' | 'x' | 'dash' | 'loader'; color: string }

/** 整体态势图标与颜色(lucide-react-native,禁 emoji) */
const KIND_GLYPH: Record<TaskStatusKind, StatusGlyph> = {
  running: { icon: 'loader', color: tokens.brand.DEFAULT },
  completed: { icon: 'check', color: tokens.success.DEFAULT },
  failed: { icon: 'x', color: tokens.danger.DEFAULT },
  interrupted: { icon: 'dash', color: tokens.warning.DEFAULT },
  idle: { icon: 'dash', color: tokens.text.secondary },
}

/** 步骤级图标与颜色(与 web PlanStepsCard 同一套语义) */
const STEP_GLYPH: Record<PlanStepStatus, StatusGlyph> = {
  pending: { icon: 'dash', color: tokens.text.tertiary },
  in_progress: { icon: 'loader', color: tokens.brand.DEFAULT },
  completed: { icon: 'check', color: tokens.success.DEFAULT },
  failed: { icon: 'x', color: tokens.danger.DEFAULT },
  skipped: { icon: 'dash', color: tokens.text.tertiary },
}

function StatusIcon({ glyph, spinning }: { glyph: StatusGlyph; spinning: boolean }) {
  // 运行态用原生 ActivityIndicator 旋转(平台惯例,lucide 静态图标无法自转)
  if (glyph.icon === 'loader' && spinning) {
    return <ActivityIndicator size="small" color={glyph.color} />
  }
  if (glyph.icon === 'check') return <Check size={14} color={glyph.color} />
  if (glyph.icon === 'x') return <X size={14} color={glyph.color} />
  if (glyph.icon === 'loader') return <Loader2 size={14} color={glyph.color} />
  return <CircleDashed size={14} color={glyph.color} />
}

function StepRow({
  step,
  translate,
}: {
  step: TaskStatusStepView
  translate: (key: string) => string
}) {
  const glyph = STEP_GLYPH[step.status]
  return (
    <View style={styles.stepRow}>
      <StatusIcon glyph={glyph} spinning={false} />
      <Text
        style={[
          styles.stepTitle,
          step.status === 'completed' && styles.stepTitleDone,
          step.status === 'in_progress' && styles.stepTitleActive,
        ]}
      >
        {humanizeToolText(step.title, translate)}
      </Text>
    </View>
  )
}

/**
 * 纯渲染组件:视图推导只调 deriveTaskStatusBar(单一真相源)。
 * 交互:流式默认展开、结束自动收起(userOpen=null 跟随 isStreaming),可手动切换。
 */
export function TaskStatusBar({ planSteps, toolCalls, isStreaming }: TaskStatusBarProps) {
  const { t } = useI18n()
  // null = 用户未干预,跟随流式状态自动展开/收起
  const [userOpen, setUserOpen] = useState<boolean | null>(null)

  // 新一轮流式开始时清除手动干预,回到"流式默认展开"
  useEffect(() => {
    if (isStreaming) setUserOpen(null)
  }, [isStreaming])

  const open = userOpen ?? isStreaming

  const view = useMemo(() => {
    // ToolCallItem(端内折叠模型)→ ToolCall(共享契约)适配:toolName 命名对齐
    const calls: ToolCall[] | undefined = toolCalls?.map((call) => ({
      id: call.id,
      toolName: call.name,
      status: call.status,
      args: call.args ?? {},
      result: call.result,
    }))
    return deriveTaskStatusBar({ planSteps, toolCalls: calls, isStreaming })
  }, [planSteps, toolCalls, isStreaming])

  if (!view) return null

  // 界面禁止直显英文工具码名:标题/步骤文本里的 read_file 等替换为本地化功能名
  const translateTool = (key: string) => t(`taskStatus.${key}`)
  const headline =
    (view.headline ? humanizeToolText(view.headline, translateTool) : '') || t('taskStatus.waiting')
  const stepText =
    view.stepTotal > 0
      ? t('taskStatus.steps', { current: view.stepCurrent, total: view.stepTotal })
      : t('taskStatus.idle')
  const filesText =
    view.changedFiles > 0 ? t('taskStatus.filesChanged', { n: view.changedFiles }) : null

  return (
    <View style={styles.wrap} testID="task-status-bar">
      <View
        style={[styles.card, view.active ? styles.cardActive : null]}
        testID={`task-status-bar-kind-${view.kind}`}
      >
        <Pressable
          style={styles.row}
          onPress={() => setUserOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? t('taskStatus.collapseDetail') : t('taskStatus.expandDetail')}
          testID="task-status-bar-toggle"
        >
          <StatusIcon glyph={KIND_GLYPH[view.kind]} spinning={view.active} />
          <Text style={styles.headline} numberOfLines={1}>
            {headline}
          </Text>
          <Text style={styles.meta}>{stepText}</Text>
          {filesText ? <Text style={styles.meta}>{filesText}</Text> : null}
          {view.linesKnown && view.changedFiles > 0 ? (
            <Text style={styles.meta}>
              <Text style={styles.diffAdded}>+{view.addedLines}</Text>
              <Text style={styles.diffRemoved}> -{view.removedLines}</Text>
            </Text>
          ) : null}
          {open ? (
            <ChevronUp size={14} color={tokens.text.secondary} />
          ) : (
            <ChevronDown size={14} color={tokens.text.secondary} />
          )}
        </Pressable>
        {open && view.stepTotal > 0 ? (
          <View style={styles.detail}>
            {view.steps.map((step) => (
              <StepRow key={step.id} step={step} translate={translateTool} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default TaskStatusBar

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginBottom: 8 },
  card: {
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    overflow: 'hidden',
  },
  cardActive: { borderColor: tokens.brandAccent.deep },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headline: { flex: 1, fontSize: 12, fontWeight: '500', color: tokens.text.primary },
  meta: { fontSize: 12, color: tokens.text.secondary, fontVariant: ['tabular-nums'] },
  diffAdded: { color: tokens.success.DEFAULT, fontVariant: ['tabular-nums'] },
  diffRemoved: { color: tokens.danger.DEFAULT, fontVariant: ['tabular-nums'] },
  detail: { paddingHorizontal: 12, paddingBottom: 8, gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  stepTitle: { flex: 1, fontSize: 12, color: tokens.text.secondary },
  stepTitleDone: { color: tokens.text.tertiary },
  stepTitleActive: { color: tokens.text.primary, fontWeight: '500' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
