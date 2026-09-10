// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:中部 Agent 进度展示区从 agent-pane.tsx 抽出,
// 复用 progress-sections 的 4 个 section 组件(接口纯数据,无 store 依赖)
import { useTranslations } from 'next-intl'
import { Bot } from 'lucide-react'
import type { AgentToolCall, AgentChange, TerminalTask, PlanStep } from '@/hooks/use-agent-progress'
import { FoldableSectionProvider } from '@/components/ai/progress-sections/foldable-section'
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallsSection } from '@/components/ai/progress-sections/tool-calls-section'
import { ChangesSection } from '@/components/ai/progress-sections/changes-section'
import { TerminalSection } from '@/components/ai/progress-sections/terminal-section'
import { PlanStepsList } from './PlanStepsList'

export interface AgentProgressAreaProps {
  thinking: string
  currentNode: string | null
  isRunning: boolean
  planSteps: PlanStep[]
  tools: AgentToolCall[]
  changes: AgentChange[]
  terminals: TerminalTask[]
  /** 是否有任何进度内容(含主组件的 result/error,决定空态占位) */
  hasProgress: boolean
}

export function AgentProgressArea({
  thinking,
  currentNode,
  isRunning,
  planSteps,
  tools,
  changes,
  terminals,
  hasProgress,
}: AgentProgressAreaProps) {
  const t = useTranslations('ide')
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-background/40 p-2"
      data-testid="agent-pane-progress"
    >
      {!hasProgress && (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/30" aria-hidden />
          <div className="text-xs text-muted-foreground/70">{t('agentPane.emptyHint')}</div>
        </div>
      )}
      {hasProgress && (
        <FoldableSectionProvider value={{ expandAll: null, setExpandAll: () => {} }}>
          <div className="space-y-1.5">
            {(thinking.length > 0 || currentNode !== null) && (
              <ThinkingSection
                content={thinking}
                currentNode={currentNode}
                isStreaming={isRunning}
              />
            )}
            {planSteps.length > 0 && <PlanStepsList steps={planSteps} />}
            <ToolCallsSection tools={tools} />
            <ChangesSection changes={changes} />
            <TerminalSection terminals={terminals} />
          </div>
        </FoldableSectionProvider>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
