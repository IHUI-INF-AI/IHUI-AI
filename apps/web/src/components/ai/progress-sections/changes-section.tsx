'use client'

import * as React from 'react'
import { FileEdit, FilePlus } from 'lucide-react'
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
 * - 标题带 FileEdit 图标
 * - 新增文件用 FilePlus(emerald) + 修改文件用 FileEdit(amber)
 * - basename + 短目录 + 分类摘要
 */
export function ChangesSection({ changes }: ChangesSectionProps) {
  if (changes.length === 0) return null

  const newCount = changes.filter((c) => c.diffInfo.is_new_file).length
  const modifyCount = changes.length - newCount

  const summaryParts: string[] = []
  if (newCount > 0) summaryParts.push(`新增 ${newCount}`)
  if (modifyCount > 0) summaryParts.push(`修改 ${modifyCount}`)
  const summary = summaryParts.join(' · ')

  const recentChanges = changes.slice(-10)

  return (
    <FoldableSection title="文件变更" count={changes.length} icon={FileEdit} data-testid="changes-section">
      <div className="space-y-0.5 text-[11px] leading-relaxed">
        {summary && (
          <div className="text-[10px] text-muted-foreground/60">{summary}</div>
        )}
        {recentChanges.map((change) => {
          const isNew = change.diffInfo.is_new_file
          const Icon = isNew ? FilePlus : FileEdit
          return (
            <div key={change.id} className="flex items-center gap-1.5">
              <Icon
                className={cn(
                  'h-2.5 w-2.5 shrink-0',
                  isNew ? 'text-emerald-500' : 'text-amber-500',
                )}
              />
              <span
                className="flex-1 break-all font-mono text-[10px] text-muted-foreground"
                title={change.filePath}
              >
                {basename(change.filePath)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground/40">
                {shortDir(change.filePath)}
              </span>
            </div>
          )
        })}
        {changes.length > 10 && (
          <div className="text-[10px] text-muted-foreground/40">
            …还有 {changes.length - 10} 项
          </div>
        )}
      </div>
    </FoldableSection>
  )
}

export default ChangesSection
