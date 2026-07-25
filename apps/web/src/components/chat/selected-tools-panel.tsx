'use client'

import * as React from 'react'
import { X, Wrench } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'

export interface SelectedToolItem {
  id: string
  name: string
  /** 真实集成度:true/'model'/undefined */
  integration?: boolean | 'model'
}

interface SelectedToolsPanelProps {
  tools: SelectedToolItem[]
  onRemove?: (id: string) => void
}

/**
 * 已选工具 chip 面板(2026-07-22 立)
 *
 * 用户从插件市场点击"+"添加到对话后,工具以 chip 形式显示在 textarea 上方,
 * 与 ContextReferencePanel 并列。sendMessage 时 chip 对应的 MCP 工具会被
 * 合并到 agentTools 传给 ai-service。
 *
 * 视觉规范(符合 AGENTS.md §4):
 *  - rounded-xl 描边卡片,无 rounded-full
 *  - gap-* 间距分隔,无 divide-y 分割线
 *  - 真实集成:绿色徽章 + 勾选图标
 *  - 模型接入:蓝色徽章
 *  - 仅 prompt 意图:灰色徽章 + 说明 tooltip
 */
export function SelectedToolsPanel({ tools, onRemove }: SelectedToolsPanelProps) {
  const t = useTranslations('chat')
  if (tools.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
        <Wrench className="h-3 w-3" />
        <span>{t('selectedToolsTitle')}</span>
        <span className="text-[10px] opacity-70">({tools.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <ToolChip key={tool.id} tool={tool} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}

function ToolChip({
  tool,
  onRemove,
}: {
  tool: SelectedToolItem
  onRemove?: (id: string) => void
}) {
  const t = useTranslations('chat')
  const isReal = tool.integration === true
  const isModel = tool.integration === 'model'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium [&>span]:translate-y-[0.5px]',
        isReal
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : isModel
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
            : 'bg-muted text-muted-foreground',
      )}
      title={
        isReal
          ? t('realIntegratedTooltip')
          : isModel
            ? t('modelIntegratedTooltip')
            : t('promptOnlyTooltip')
      }
    >
      <span>{tool.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(tool.id)}
          aria-label={t('removeTool', { name: tool.name })}
          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-sm hover:bg-foreground/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
