'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { type LucideIcon, Terminal, Bot, Brain, GitFork, Clock, Repeat, Layers, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StepType } from './types'

const PALETTE_ITEMS: { type: StepType; icon: LucideIcon; desc: string }[] = [
  { type: 'echo', icon: Terminal, desc: '返回固定内容,用于测试' },
  { type: 'skill', icon: Bot, desc: '调用 AI 技能处理文本' },
  { type: 'llm', icon: Brain, desc: '直接调用 LLM 模型' },
  { type: 'condition', icon: GitFork, desc: '基于条件分支执行' },
  { type: 'delay', icon: Clock, desc: '等待指定时长' },
  { type: 'loop', icon: Repeat, desc: '重复执行 N 次' },
  { type: 'parallel', icon: Layers, desc: '同时执行多个步骤' },
  { type: 'tool', icon: Wrench, desc: '调用 MCP 工具' },
]

const ITEM_COLORS: Record<StepType, string> = {
  echo: 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300',
  skill: 'border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-300',
  llm: 'border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-300',
  condition: 'border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-300',
  delay: 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300',
  loop: 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-300',
  parallel: 'border-violet-300 dark:border-violet-600 text-violet-600 dark:text-violet-300',
  tool: 'border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-300',
  trigger: 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-300',
}

interface Props {
  onDragStart: (type: StepType) => void
}

export function NodePalette({ onDragStart }: Props) {
  const t = useTranslations('workflows')

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: StepType) => {
      e.dataTransfer.setData('application/reactflow', type)
      e.dataTransfer.effectAllowed = 'move'
      onDragStart(type)
    },
    [onDragStart],
  )

  return (
    <div className="w-56 shrink-0 border-r bg-card">
      <div className="border-b px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        {t('editor.palette')}
      </div>
      <div className="space-y-1 p-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => handleDragStart(e, item.type)}
              className={cn(
                'flex cursor-grab items-center gap-2 rounded-md border px-2.5 py-2 text-xs transition-colors hover:bg-accent active:cursor-grabbing',
                ITEM_COLORS[item.type],
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t(`editor.types.${item.type}`, { defaultValue: item.type })}</div>
                <div className="truncate text-[10px] text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}