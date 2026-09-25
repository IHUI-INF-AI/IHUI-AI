// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronRight, CirclePlay, FlaskConical, GitCommitHorizontal, ListChecks, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useChatStore } from '@/stores/chat'
import type { PlanStep } from '@/hooks/use-agent-progress'

/**
 * NextStepsCard — 对话终点「下一步推荐」卡片(2026-09-18 立,AI 对话下一步引导)
 *
 * 对标 Qoder 推荐下一步卡片 / Codex 队列引导:流结束时在任务进度面板庆祝横幅附近
 * 展示最多 3 条确定性推导(不走 LLM)的建议,点击即写入 chat store 草稿并自动发送。
 *
 * 推导规则(确定性,按优先级取第一条命中):
 * ① steps 存在 pending/in_progress → "继续执行剩余 N 步:<第一步名称>"
 * ② steps 全部 completed 且存在文件修改类工具(edit_file/file_edit/write_file/create_file)
 *    → "运行测试验证变更" + "提交代码变更" 两条
 * ③ 其余(steps 为空、或全完成但无文件修改工具)→ 只显示"总结本次对话进展"
 *
 * 生命周期:
 * - visible=false(流式中/无消息)不渲染;visible 由 pane 以 `!isStreaming && messages.length > 0` 计算
 * - 右上角 X → 内部 dismissed 置 true(卡片隐藏)+ 通知父级 onDismiss
 * - 流式重新开始时 pane 把 visible 切回 false,组件据此重置 dismissed,下一轮流结束可再次展示
 */
interface NextStepsCardProps {
  /** 当前任务计划步骤(来自 useAgentProgress) */
  steps: PlanStep[]
  /** 是否可见(流结束 + 对话有消息) */
  visible: boolean
  /** 点击右上角 X 关闭时的回调(卡片同时内部自隐藏) */
  onDismiss: () => void
  /** 本次会话工具调用列表(可选,用于规则②判断是否出现过文件修改类工具) */
  tools?: ReadonlyArray<{ toolName: string }>
  'data-testid'?: string
}

type NextSuggestionKey = 'continue' | 'run-tests' | 'commit' | 'summarize'

interface NextSuggestion {
  key: NextSuggestionKey
  icon: React.ComponentType<{ className?: string }>
  label: string
}

// 与 tool-call-summary-card.tsx 的 FILE_MODIFY_TOOLS 对齐(规则②不含 delete_file:
// 删除文件不代表"产生了需要测试/提交的变更")
const FILE_MODIFY_TOOLS = new Set(['edit_file', 'file_edit', 'write_file', 'create_file'])

// ─── i18n 安全回退(照抄 tool-call-summary-card.tsx 模式,不依赖 locale JSON) ──

const warnedKeys = new Set<string>()
type LooseTranslator = (key: string, values?: Record<string, unknown>) => string

/** 用 values 填充 fallback 模板中的 {param} 占位符(locale 缺 key 时兜底用) */
function fillParams(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

/** locale key 缺失时回退到代码内中文文案并 console.warn 一次 */
function safeT(
  t: ReturnType<typeof useTranslations<'ai.pane'>>,
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
): string {
  const looseT = t as unknown as LooseTranslator
  try {
    const v = looseT(key, values)
    if (v === key || !v) {
      if (!warnedKeys.has(key)) {
        warnedKeys.add(key)
        console.warn(
          `[next-steps-card] i18n key 'ai.pane.${key}' missing, using fallback: "${fallback}"`,
        )
      }
      return values ? fillParams(fallback, values) : fallback
    }
    return v
  } catch {
    return values ? fillParams(fallback, values) : fallback
  }
}

function NextStepsCardBase({
  steps,
  visible,
  onDismiss,
  tools,
  'data-testid': dataTestId,
}: NextStepsCardProps) {
  const t = useTranslations('ai.pane')

  // 内部 dismissed:点 X 后自隐藏;流式重启时 pane 把 visible 切回 false → 重置,
  // 下一轮流结束(visible 重新为 true)可再次展示
  const [dismissed, setDismissed] = React.useState<boolean>(false)
  React.useEffect(() => {
    if (!visible) setDismissed(false)
  }, [visible])

  // 确定性推导最多 3 条建议(不走 LLM)
  const suggestions = React.useMemo<NextSuggestion[]>(() => {
    const activeSteps = steps.filter((s) => s.status === 'pending' || s.status === 'in_progress')
    const first = steps.find((s) => s.status === 'pending' || s.status === 'in_progress')
    // ① 有未完成步骤 → 继续执行剩余 N 步(拼入第一步名称)
    if (first) {
      return [
        {
          key: 'continue',
          icon: CirclePlay,
          label: `${safeT(t, 'nextStepsContinue', '继续执行剩余 {n} 步', { n: activeSteps.length })}：${first!.step}`,
        },
      ]
    }
    // ② 全部完成且出现过文件修改类工具 → 运行测试 + 提交代码
    const allComplete = steps.length > 0 && steps.every((s) => s.status === 'completed')
    const hasFileModify = (tools ?? []).some((tool) => FILE_MODIFY_TOOLS.has(tool.toolName))
    if (allComplete && hasFileModify) {
      return [
        {
          key: 'run-tests',
          icon: FlaskConical,
          label: safeT(t, 'nextStepsRunTests', '运行测试验证变更'),
        },
        {
          key: 'commit',
          icon: GitCommitHorizontal,
          label: safeT(t, 'nextStepsCommit', '提交代码变更'),
        },
      ]
    }
    // ③ 兜底(steps 为空 / 全完成但无文件修改)→ 总结本次对话进展
    return [
      {
        key: 'summarize',
        icon: ListChecks,
        label: safeT(t, 'nextStepsSummarize', '总结本次对话进展'),
      },
    ]
  }, [steps, tools, t])

  const handleSuggestionClick = React.useCallback((label: string) => {
    // chat store 无 setDraftInput action,直接用 zustand 静态 setState 写入草稿 + 自动发送
    useChatStore.setState({ draftInput: label, draftAutoSend: true })
  }, [])

  const handleDismiss = React.useCallback(() => {
    setDismissed(true)
    onDismiss()
  }, [onDismiss])

  // 流式中 / 无消息 / 已关闭 → 不渲染(hooks 已全部在其上方,无条件调用问题)
  if (!visible || dismissed) return null

  const testId = dataTestId ?? 'next-steps-card'
  const title = safeT(t, 'nextStepsTitle', '下一步推荐')
  const dismissLabel = safeT(t, 'nextStepsDismiss', '关闭')

  return (
    <section
      className="shrink-0 border-t border-border/60 bg-muted/30 px-2 py-1.5"
      aria-label={title}
      data-testid={testId}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
          <Sparkles className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          {title}
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={dismissLabel}
          className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          data-testid={`${testId}-dismiss`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {suggestions.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => handleSuggestionClick(s.label)}
            className="flex w-full items-center gap-1.5 rounded-sm border border-border/60 bg-background px-2 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            data-testid={`${testId}-suggestion-${s.key}`}
          >
            <s.icon className="h-3 w-3 shrink-0 text-primary" aria-hidden />
            <span className="flex-1 truncate">{s.label}</span>
            <ChevronRight className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  )
}

export const NextStepsCard = React.memo(NextStepsCardBase)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
