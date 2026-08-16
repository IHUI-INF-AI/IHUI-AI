'use client'

import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Switch } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import type { HomeSectionSchema, SectionComponentType } from '@/components/marketing/home-schema'

/** 组件类型 → 中文显示名 */
export const COMPONENT_LABELS: Record<SectionComponentType, string> = {
  hero: 'Hero 首屏',
  featureGrid: '核心能力',
  scenarios: '应用场景',
  roi: '投资回报',
  comparison: '竞品对比',
  pricing: '定价方案',
  magazine: '新闻杂志',
}

interface SortableSectionProps {
  section: HomeSectionSchema
  index: number
  onToggle: (id: string) => void
}

/** 可拖拽排序的 section 行:拖拽手柄 + 序号 + 名称 + 组件类型 + 显隐开关 */
export function SortableSection({ section, index, onToggle }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-shadow',
        isDragging && 'shadow-lg',
        !section.enabled && 'opacity-50',
      )}
    >
      {/* 拖拽手柄 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="拖拽排序"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* 序号 */}
      <span className="w-6 text-center text-xs font-medium text-muted-foreground">{index + 1}</span>

      {/* section 名称 + 组件类型 */}
      <div className="flex flex-1 items-center gap-2">
        <span className="text-sm font-medium">{COMPONENT_LABELS[section.component]}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {section.component}
        </code>
      </div>

      {/* 显隐开关 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{section.enabled ? '显示' : '隐藏'}</span>
        <Switch checked={section.enabled} onCheckedChange={() => onToggle(section.id)} />
      </div>
    </div>
  )
}
