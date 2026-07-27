'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { FoldableSection } from './foldable-section'
import type { AgentChange } from '@/hooks/use-agent-progress'

interface ChangesSectionProps {
  changes: AgentChange[]
}

/** 从文件路径提取 basename */
function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || filePath
}

/** 从文件路径提取短目录(最后 2 级) */
function shortDir(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  if (parts.length <= 2) return filePath
  return '…/' + parts.slice(-2).join('/')
}

/**
 * ChangesSection — 文件变更折叠子区
 *
 * 对齐 Trae Work 文件变更展示:
 * - 折叠时:标题 "文件变更" + 计数
 * - 展开时:新增/修改标记 + 文件路径 + 工具名
 */
export function ChangesSection({ changes }: ChangesSectionProps) {
  if (changes.length === 0) return null

  const newCount = changes.filter((c) => c.diffInfo.is_new_file).length
  const modifyCount = changes.length - newCount

  const summaryParts: string[] = []
  if (newCount > 0) summaryParts.push(`新增 ${newCount}`)
  if (modifyCount > 0) summaryParts.push(`修改 ${modifyCount}`)
  const summary = summaryParts.join(', ')

  const recentChanges = changes.slice(-10)

  return (
    <FoldableSection title="文件变更" count={changes.length} data-testid="changes-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && <div className="text-muted-foreground/80">{summary}</div>}
        {recentChanges.map((change) => {
          const isNew = change.diffInfo.is_new_file
          return (
            <div key={change.id} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'w-3 shrink-0 text-center',
                  isNew ? 'text-emerald-500' : 'text-amber-500',
                )}
                title={isNew ? '新增文件' : '修改文件'}
              >
                {isNew ? '+' : '~'}
              </span>
              <span
                className="flex-1 break-all text-muted-foreground"
                title={change.filePath}
              >
                {basename(change.filePath)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground/60">
                {shortDir(change.filePath)}
              </span>
            </div>
          )
        })}
        {changes.length > 10 && (
          <div className="text-[10px] text-muted-foreground/60">
            …还有 {changes.length - 10} 项
          </div>
        )}
      </div>
    </FoldableSection>
  )
}

export default ChangesSection
