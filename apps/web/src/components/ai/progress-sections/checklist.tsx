// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { humanizeToolText } from '@ihui/shared/chat'
import type { PlanStepStatus } from '@ihui/types'
import { cn } from '@/lib/utils'
import { StreamRow, planStepStreamStatus } from '@/components/chat/stream/stream-ui'

export interface ChecklistItemData {
  id: string
  label: string
  // 五态复用契约类型,与 @ihui/types PlanStepStatus 保持一致
  status: PlanStepStatus
  meta?: React.ReactNode
  description?: React.ReactNode
}

interface ChecklistProps {
  items: ChecklistItemData[]
  dense?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Checklist — 迷你清单(步骤关联的工具调用、子代理动作序列等)。
 *
 * 2026-09-22 接入 `stream-ui` 基元:一行 = 一条 StreamRow,与计划步骤、工具卡同字号同图标;
 * 改造前自配 10/11px 两档字号 + 独立色板,在同气泡里读起来是第四种视觉语言。
 * 五态 → StreamStatus 的收敛不再自配映射表,统一走基元 `planStepStreamStatus`
 * (与计划步骤同一口径);label 常为工具码名(read_file / write_file),必须过
 * `humanizeToolText` 本地化,禁止直显英文码名。
 */
export const Checklist = React.memo(function Checklist({
  items,
  dense = false,
  className,
  'data-testid': testId,
}: ChecklistProps) {
  const tStatus = useTranslations('taskStatus')
  if (items.length === 0) return null
  const rootTestId = testId ?? 'checklist'
  return (
    <ul
      className={cn('space-y-0.5', dense && 'space-y-0', className)}
      data-testid={rootTestId}
      data-checklist-dense={dense ? 'true' : 'false'}
    >
      {items.map((item) => {
        const status = planStepStreamStatus(item)
        const label = humanizeToolText(item.label, tStatus)
        return (
          <li
            key={item.id}
            className="-mx-1 rounded-sm px-1"
            aria-label={label}
            data-status={item.status}
            data-stream-status={status}
            data-testid={`${rootTestId}-item-${item.id}`}
          >
            <StreamRow
              status={status}
              title={label}
              titleMode="primary"
              meta={item.meta}
              ariaLabel={label}
              testId={`${rootTestId}-row-${item.id}`}
            />
            {item.description && (
              <div className="ml-5 break-words text-xs leading-relaxed text-muted-foreground/70">
                {item.description}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
})

export default Checklist
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
