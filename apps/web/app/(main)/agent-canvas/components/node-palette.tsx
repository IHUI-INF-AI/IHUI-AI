// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Wrench, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NODE_TYPE_META, type CanvasNodeType } from '../types'

const PALETTE_ITEMS: { type: CanvasNodeType; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { type: 'agent', icon: Bot },
    { type: 'tool', icon: Wrench },
    { type: 'human-review', icon: UserCheck },
  ]

export const CANVAS_DND_MIME = 'application/agent-canvas'

interface NodePaletteProps {
  /** 点击调色板项时快速添加节点(拖拽之外的辅助入口) */
  onAdd: (type: CanvasNodeType) => void
}

/** 左侧任务节点面板:拖拽(dragstart 携带节点类型)或点击添加到画布 */
export function NodePalette({ onAdd }: NodePaletteProps) {
  const t = useTranslations('agentCanvas')
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, type: CanvasNodeType) => {
    e.dataTransfer.setData(CANVAS_DND_MIME, type)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="flex w-52 shrink-0 flex-col border-r bg-card">
      <div className="border-b px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('paletteTitle')}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {PALETTE_ITEMS.map(({ type, icon: Icon }) => {
          const meta = NODE_TYPE_META[type]
          return (
            <div
              key={type}
              role="button"
              tabIndex={0}
              aria-label={`添加 ${meta.title} 节点`}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              onClick={() => onAdd(type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onAdd(type)
                }
              }}
              className={cn(
                'cursor-grab rounded-lg border-2 bg-background p-2.5 transition-shadow hover:shadow-md active:cursor-grabbing',
                meta.border,
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded', meta.badge)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium">
                  {t(type === 'agent' ? 'typeAgent' : type === 'tool' ? 'typeTool' : 'typeReview')}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                {t(
                  type === 'agent'
                    ? 'typeAgentDesc'
                    : type === 'tool'
                      ? 'typeToolDesc'
                      : 'typeReviewDesc',
                )}
              </p>
            </div>
          )
        })}
      </div>
      <p className="mt-auto px-3 pb-3 text-[11px] leading-snug text-muted-foreground/80">
        {t('paletteHint')}
      </p>
    </div>
  )
}
