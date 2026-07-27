'use client'

import * as React from 'react'
import { FileEdit, FilePlus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoldableSection } from './foldable-section'
import { CopyButton } from './copy-button'
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

/** 截断超长字符串(最大 500 字符) */
function truncateForDisplay(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n…(已截断,共 ${s.length} 字符)`
}

/** v11: 单个文件变更项(可点击展开 diff 预览) */
const ChangeItem = React.memo(function ChangeItem({ change }: { change: AgentChange }) {
  const [expanded, setExpanded] = React.useState(false)
  const isNew = change.diffInfo.is_new_file
  const Icon = isNew ? FilePlus : FileEdit
  const hasDiff = !!change.diffInfo.new_content || !!change.diffInfo.old_content
  const toggleExpand = () => {
    if (hasDiff) setExpanded((v) => !v)
  }

  return (
    <div className="rounded-sm transition-colors hover:bg-accent/40">
      <div
        className={cn(
          'flex items-center gap-1.5 px-1 py-0.5',
          hasDiff && 'cursor-pointer',
        )}
        onClick={toggleExpand}
        role={hasDiff ? 'button' : undefined}
        aria-expanded={hasDiff ? expanded : undefined}
        tabIndex={hasDiff ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDiff && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            toggleExpand()
          }
        }}
        data-testid={`change-item-${change.id}`}
      >
        {hasDiff && (
          <ChevronRight
            className={cn(
              'h-2 w-2 shrink-0 text-muted-foreground/60 transition-transform duration-150',
              expanded && 'rotate-90',
            )}
          />
        )}
        {!hasDiff && <span className="w-2 shrink-0" />}
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
        <span className="shrink-0 text-[10px] text-muted-foreground/60">
          {shortDir(change.filePath)}
        </span>
      </div>
      {hasDiff && (
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 px-3 pb-1 pt-0.5 text-[10px] leading-relaxed">
              {!isNew && change.diffInfo.old_content && (
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-red-500/60">原内容</span>
                    <CopyButton
                      text={change.diffInfo.old_content}
                      aria-label="复制原内容"
                      data-testid={`change-copy-old-${change.id}`}
                    />
                  </div>
                  <pre className="mt-0.5 max-h-16 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-red-500/10 p-1 font-mono text-[10px] text-red-500/80">
                    {truncateForDisplay(change.diffInfo.old_content)}
                  </pre>
                </div>
              )}
              {change.diffInfo.new_content && (
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-emerald-500/60">
                      {isNew ? '新文件' : '新内容'}
                    </span>
                    <CopyButton
                      text={change.diffInfo.new_content}
                      aria-label="复制新内容"
                      data-testid={`change-copy-new-${change.id}`}
                    />
                  </div>
                  <pre className="mt-0.5 max-h-16 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-emerald-500/10 p-1 font-mono text-[10px] text-emerald-500/80">
                    {truncateForDisplay(change.diffInfo.new_content)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

/**
 * ChangesSection — 文件变更折叠子区
 *
 * v11: 点击文件行展开 diff 预览(原内容 vs 新内容 + 复制按钮)
 * v10 memo:React.memo 包装,changes 引用稳定时跳过重渲染
 */
export const ChangesSection = React.memo(function ChangesSection({
  changes,
}: ChangesSectionProps) {
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
        {recentChanges.map((change) => (
          <ChangeItem key={change.id} change={change} />
        ))}
        {changes.length > 10 && (
          <div className="text-[10px] text-muted-foreground/60">
            …还有 {changes.length - 10} 项
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default ChangesSection
