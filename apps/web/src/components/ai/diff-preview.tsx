// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 两栏(并排)diff 预览(V3 #66 收敛,2026-09-26)。
 *
 * 本组件此前**自带一份 LCS**(`computeLcsDiff`)并两列各 map 一遍 rows ——
 * 那是仓里第三份行级 diff 实现(另两份在 `@/lib/hunk-diff` 与 chat 卡片),
 * 且不折叠、不配对、两侧行序无法保证同义。现只剩"容器 + 列头",排版全部
 * 交给 `@/lib/diff-split-rows` 的唯一投影与 `SplitDiffBody` 的唯一渲染体。
 *
 * props 形状保持向后兼容(`checkpoint-rollback-confirm.tsx` 是另一处调用方)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { DEFAULT_CONTEXT_LINES } from '@/lib/diff-split-rows'
import { buildSplitEntries, SplitDiffBody } from './inline-diff-viewer'

interface DiffPreviewProps {
  oldContent: string
  newContent: string
  language?: string
  filename?: string
  /** 折叠上下文行数;`Infinity` 关闭折叠 */
  contextLines?: number
  className?: string
}

export function DiffPreview({
  oldContent,
  newContent,
  language,
  filename,
  contextLines = DEFAULT_CONTEXT_LINES,
  className,
}: DiffPreviewProps) {
  const t = useTranslations('ide')
  const entries = React.useMemo(
    () => buildSplitEntries(oldContent, newContent, contextLines),
    [oldContent, newContent, contextLines],
  )

  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-background', className)}>
      {(filename || language) && (
        <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5">
          {filename && <span className="text-xs font-medium text-muted-foreground">{filename}</span>}
          {language && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {language}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto font-mono text-xs">
        <SplitDiffBody
          entries={entries}
          columnLabels={{ left: t('diffViewer.oldVersion'), right: t('diffViewer.newVersion') }}
        />
      </div>
    </div>
  )
}

export default DiffPreview
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
