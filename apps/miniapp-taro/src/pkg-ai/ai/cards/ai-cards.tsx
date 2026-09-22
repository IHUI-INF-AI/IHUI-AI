// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 AI 流式执行过程工具卡片(计划「#12 小程序 AI 增强」核心交付之二)。
 *
 * 对标 web 端 ai-side-panel 的 PlanStepsCard / SubAgentActivityFeed / 终端卡片,
 * 以及 mobile-rn AiAssistantN8nScreen 的工具卡,原生渲染三类卡片:
 *  1. 计划步骤(PlanStepsCard)— Codex 三状态(pending / in_progress / completed)
 *  2. 工具调用(ToolCallCard)— 名称 + 状态 + 耗时
 *  3. 终端输出(TerminalCard)— 命令 + 状态 + 输出(可复制)
 *
 * 视觉对齐项目 tokens(src/app.css):卡片底 --color-streamed-container-bg,
 * 边框 --color-border,状态色 --color-success / --color-warning / --color-danger,
 * 图标用 LineIcon(禁用 emoji / 原生 alert)。容器圆角用具体数值(禁 rounded-full)。
 */
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'
import LineIcon from '@/components/LineIcon'
import type { ToolCallView, PlanStepView, TerminalTaskView } from '@/pkg-ai/ai/cards/types'
import {
  formatToolMetric,
  localizeToolText,
  toolDelta,
  toolRowTitle,
  viewToolCall,
} from '@/pkg-ai/ai/cards/tool-line'
import type { ToolSubjectKind } from '@ihui/shared/chat'
import './ai-cards.css'

/** 对象等宽档:与 web stream-ui 的 STREAM_SUBJECT_MONO 同判据(路径 / URL / 命令用等宽体) */
const MONO_SUBJECT_KINDS: ReadonlySet<ToolSubjectKind> = new Set(['path', 'url', 'command'])

/** 耗时格式化(ms / s,单位非中文,无需 i18n) */
function formatDuration(ms?: number): string {
  if (typeof ms !== 'number' || ms <= 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** 工具来源角标文案 key(映射到 ai.cards.source.*) */
function sourceLabelKey(source?: ToolCallView['serverSource']): string | null {
  if (source === 'builtin') return 'ai.cards.source.builtin'
  if (source === 'plugin') return 'ai.cards.source.plugin'
  if (source === 'mcp') return 'ai.cards.source.mcp'
  return null
}

/* ===================== 计划步骤卡片 ===================== */
export function PlanStepsCard({ steps }: { steps: PlanStepView[] }) {
  const { t } = useI18n()
  if (!steps.length) return null
  return (
    <View className="ai-card-section">
      <View className="ai-card-section-head">
        <LineIcon name="bar-chart-3" size={28} color="var(--color-primary)" />
        <Text className="ai-card-section-title">{t('ai.cards.plan.title')}</Text>
        <Text className="ai-card-section-count">{steps.length}</Text>
      </View>
      <View className="ai-card-plan-list">
        {steps.map((s, i) => {
          const statusClass =
            s.status === 'completed' ? 'done' : s.status === 'in_progress' ? 'running' : 'pending'
          const errClass = s.error ? ' error' : ''
          return (
            <View className="ai-card-plan-item" key={s.id || i}>
              <View className={`ai-card-plan-dot ${statusClass}${errClass}`}>
                {s.status === 'completed' ? (
                  <LineIcon name="check-success" size={22} color="var(--color-white)" />
                ) : s.status === 'in_progress' ? (
                  <View className="ai-card-spinner">
                    <View className="ai-card-spinner-dot" />
                    <View className="ai-card-spinner-dot" />
                    <View className="ai-card-spinner-dot" />
                  </View>
                ) : null}
              </View>
              <View className="ai-card-plan-body">
                <Text className={`ai-card-plan-text${errClass}`}>
                  {localizeToolText(s.step, t)}
                </Text>
                {s.explanation ? (
                  <Text className="ai-card-plan-explain">{localizeToolText(s.explanation, t)}</Text>
                ) : null}
                {s.status === 'completed' && formatDuration(s.durationMs) ? (
                  <Text className="ai-card-plan-duration">{formatDuration(s.durationMs)}</Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ===================== 工具调用卡片 ===================== */
export function ToolCallCard({ calls }: { calls: ToolCallView[] }) {
  const { t } = useI18n()
  if (!calls.length) return null
  return (
    <View className="ai-card-section">
      <View className="ai-card-section-head">
        <LineIcon name="flask-conical" size={28} color="var(--color-primary)" />
        <Text className="ai-card-section-title">{t('ai.cards.tool.title')}</Text>
        <Text className="ai-card-section-count">{calls.length}</Text>
      </View>
      <View className="ai-card-tool-list">
        {calls.map((c, i) => {
          const key = c.id || `tool_${i}`
          const labelKey =
            c.status === 'running'
              ? 'ai.cards.status.running'
              : c.status === 'error'
                ? 'ai.cards.status.failed'
                : 'ai.cards.status.done'
          const srcKey = sourceLabelKey(c.serverSource)
          // 一行话的素材来自共享层:功能名 + 对象 + 结果度量 + 写类 ± 行数(端内不再自行挖 args/result)
          const view = viewToolCall(c)
          const metric = formatToolMetric(view.metricKind, view.metricValue, t)
          const delta = view.writesFile ? toolDelta(view, t) : { added: null, removed: null }
          const elapsed = formatDuration(c.durationMs)
          return (
            <View className={`ai-card-tool-item${c.status === 'error' ? ' error' : ''}`} key={key}>
              <View className="ai-card-tool-icon">
                {c.status === 'running' ? (
                  <View className="ai-card-spinner">
                    <View className="ai-card-spinner-dot" />
                    <View className="ai-card-spinner-dot" />
                    <View className="ai-card-spinner-dot" />
                  </View>
                ) : c.status === 'error' ? (
                  <LineIcon name="triangle-alert" size={28} color="var(--color-danger)" />
                ) : (
                  <LineIcon name="check-success" size={28} color="var(--color-success)" />
                )}
              </View>
              <View className="ai-card-tool-body">
                <View className="ai-card-tool-row">
                  <Text className="ai-card-tool-name">{toolRowTitle(c, t)}</Text>
                  {view.subject ? (
                    <Text
                      className={`ai-card-tool-subject${
                        MONO_SUBJECT_KINDS.has(view.subjectKind) ? ' mono' : ''
                      }`}
                    >
                      {view.subject}
                    </Text>
                  ) : (
                    <View className="ai-card-tool-subject-spacer" />
                  )}
                  {srcKey ? <Text className="ai-card-tool-source">{t(srcKey)}</Text> : null}
                </View>
                <View className="ai-card-tool-row">
                  <Text
                    className={`ai-card-tool-status ${c.status === 'error' ? 'error' : c.status === 'running' ? 'running' : 'done'}`}
                  >
                    {t(labelKey)}
                  </Text>
                  {metric ? <Text className="ai-card-tool-metric">{metric}</Text> : null}
                  {delta.added || delta.removed ? (
                    <Text className="ai-card-tool-lines">
                      {delta.added ? (
                        <Text className="ai-card-tool-lines-added">{delta.added}</Text>
                      ) : null}
                      {delta.removed ? (
                        <Text className="ai-card-tool-lines-removed">{delta.removed}</Text>
                      ) : null}
                    </Text>
                  ) : null}
                  {elapsed ? <Text className="ai-card-tool-duration">{elapsed}</Text> : null}
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ===================== 终端输出卡片 ===================== */
function TerminalTaskItem({
  task,
  t,
}: {
  task: TerminalTaskView
  t: (k: string, p?: Record<string, string | number>) => string
}) {
  const [copied, setCopied] = useState(false)
  const copyOutput = () => {
    if (!task.output) return
    Taro.setClipboardData({
      data: task.output,
      success: () => {
        setCopied(true)
        Taro.showToast({ title: t('ai.cards.terminal.copied'), icon: 'none' })
        setTimeout(() => setCopied(false), 1500)
      },
    })
  }
  const statusKey =
    task.status === 'running'
      ? 'ai.cards.status.running'
      : task.status === 'failed'
        ? 'ai.cards.status.failed'
        : 'ai.cards.status.done'
  return (
    <View className={`ai-card-term-item${task.status === 'failed' ? ' error' : ''}`}>
      <View className="ai-card-term-head">
        <View className="ai-card-term-cmd">
          <Text className="ai-card-term-prompt">$</Text>
          <Text className="ai-card-term-command">{task.command}</Text>
        </View>
        <View className="ai-card-term-meta">
          <Text
            className={`ai-card-term-status ${task.status === 'failed' ? 'error' : task.status === 'running' ? 'running' : 'done'}`}
          >
            {t(statusKey)}
          </Text>
          {formatDuration(task.durationMs) ? (
            <Text className="ai-card-term-duration">{formatDuration(task.durationMs)}</Text>
          ) : null}
        </View>
      </View>
      {task.output ? (
        <View className="ai-card-term-output-wrap">
          <Text className="ai-card-term-output">{task.output}</Text>
          <View className="ai-card-term-copy" onClick={copyOutput} hoverClass="opacity-60">
            <LineIcon
              name={copied ? 'check-success' : 'more-vertical'}
              size={28}
              color="var(--color-muted-foreground)"
            />
            <Text className="ai-card-term-copy-text">
              {copied ? t('ai.cards.terminal.copied') : t('ai.cards.terminal.copy')}
            </Text>
          </View>
        </View>
      ) : null}
      {/* 后端只下发截断后的文本,复制按钮拿到的也只是这段 → 必须交代原始长度 */}
      {task.truncated ? (
        <Text className="ai-card-term-truncated">
          {t('ai.cards.terminal.truncated', {
            total: task.totalChars ?? task.output?.length ?? 0,
          })}
        </Text>
      ) : null}
      {task.status === 'failed' ? (
        <Text className="ai-card-term-error">
          {t('ai.cards.terminal.exitCode', { code: task.exitCode ?? 1 })}
        </Text>
      ) : null}
    </View>
  )
}

export function TerminalCard({ tasks }: { tasks: TerminalTaskView[] }) {
  const { t } = useI18n()
  if (!tasks.length) return null
  return (
    <View className="ai-card-section">
      <View className="ai-card-section-head">
        <LineIcon name="message-square" size={28} color="var(--color-primary)" />
        <Text className="ai-card-section-title">{t('ai.cards.terminal.title')}</Text>
        <Text className="ai-card-section-count">{tasks.length}</Text>
      </View>
      {tasks.map((task, i) => (
        <TerminalTaskItem task={task} t={t} key={task.id || `term_${i}`} />
      ))}
    </View>
  )
}

/* ===================== 容器:折叠 / 三类卡片汇总 ===================== */
export interface StreamActivityCardsProps {
  planSteps: PlanStepView[]
  toolCalls: ToolCallView[]
  terminalTasks: TerminalTaskView[]
  expanded: boolean
  onToggleExpand: () => void
}

export function StreamActivityCards({
  planSteps,
  toolCalls,
  terminalTasks,
  expanded,
  onToggleExpand,
}: StreamActivityCardsProps) {
  const { t } = useI18n()
  const total = planSteps.length + toolCalls.length + terminalTasks.length
  if (total === 0) return null
  return (
    <View className="ai-card-root">
      <View className="ai-card-root-head" onClick={onToggleExpand} hoverClass="opacity-60">
        <LineIcon name="flask-conical" size={28} color="var(--color-muted-foreground)" />
        <Text className="ai-card-root-title">
          {t('ai.stream.title')} ({total})
        </Text>
        <LineIcon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={28}
          color="var(--color-muted-foreground)"
          className="ai-card-root-chevron"
        />
      </View>
      {expanded ? (
        <View className="ai-card-root-body">
          <PlanStepsCard steps={planSteps} />
          <ToolCallCard calls={toolCalls} />
          <TerminalCard tasks={terminalTasks} />
        </View>
      ) : null}
    </View>
  )
}
