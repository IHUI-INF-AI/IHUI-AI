// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'
// 2026-09-09 0-6 组件拆分:顶部 Agent 任务输入区从 agent-pane.tsx 抽出
import { useTranslations } from 'next-intl'
import { Loader2, Play } from 'lucide-react'
import { MODEL_OPTIONS } from './model'

export interface AgentInputAreaProps {
  goal: string
  onGoalChange: (value: string) => void
  model: string
  onModelChange: (value: string) => void
  /** goal 模式硬性指标(每行一条);空 = 不启用独立校验闸门 */
  criteria: string
  onCriteriaChange: (value: string) => void
  isRunning: boolean
  canRun: boolean
  onRun: () => void
}

export function AgentInputArea({
  goal,
  onGoalChange,
  model,
  onModelChange,
  criteria,
  onCriteriaChange,
  isRunning,
  canRun,
  onRun,
}: AgentInputAreaProps) {
  const t = useTranslations('ide')
  return (
    <div className="shrink-0 space-y-2 bg-card p-2">
      <textarea
        data-testid="agent-pane-goal-input"
        value={goal}
        onChange={(e) => onGoalChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            onRun()
          }
        }}
        placeholder={t('agentPane.placeholder')}
        rows={3}
        disabled={isRunning}
        aria-label={t('agentPane.placeholder')}
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-60"
      />
      {/*
        goal 模式的硬性指标必须**执行前**声明(AGENTS.md §8 第 1 步),否则独立校验闸门
        没有对照物可判。这里只负责把它喂给 hard_criteria,判定权在 ai-service 的闸门。
      */}
      <label className="block space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          {t('agentPane.criteriaLabel')}
        </span>
        <textarea
          data-testid="agent-pane-criteria-input"
          value={criteria}
          onChange={(e) => onCriteriaChange(e.target.value)}
          rows={2}
          disabled={isRunning}
          placeholder={t('agentPane.criteriaPlaceholder')}
          aria-label={t('agentPane.criteriaLabel')}
          className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-60"
        />
      </label>
      <div className="flex items-center gap-1.5">
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={isRunning}
          aria-label={t('agentPane.modelSelect')}
          className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring/40 disabled:opacity-60"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.labelKey ? t(opt.labelKey) : opt.label}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-cta px-2.5 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="agent-pane-run-btn"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Play className="h-3 w-3" aria-hidden />
          )}
          <span>{t('agentPane.execute')}</span>
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
