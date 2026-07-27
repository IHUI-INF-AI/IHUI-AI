'use client'

import * as React from 'react'
import { Brain, Loader2 } from 'lucide-react'
import { FoldableSection } from './foldable-section'

interface ThinkingSectionProps {
  /** LLM 累积输出内容(来自 token 事件) */
  content: string
  /** 当前执行节点名(来自 node_start 事件) */
  currentNode: string | null
  /** 是否正在流式输出 */
  isStreaming: boolean
}

/**
 * ThinkingSection — 思考过程折叠子区
 *
 * 对齐 Trae Work "思考过程 >" 折叠区:
 * - 标题带 Brain 图标
 * - 折叠时:标题 "思考过程" + streaming 时 Loader2 旋转
 * - 展开时:当前节点 + LLM 累积内容(可滚动,max-h-20)
 */
export function ThinkingSection({ content, currentNode, isStreaming }: ThinkingSectionProps) {
  const hasContent = content.length > 0 || currentNode !== null
  if (!hasContent) return null

  return (
    <FoldableSection title="思考过程" icon={Brain} data-testid="thinking-section">
      <div className="space-y-1 text-[11px] leading-relaxed">
        {currentNode && (
          <div className="flex items-center gap-1 text-primary">
            {isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            <span className="break-all">{currentNode}</span>
          </div>
        )}
        {content && (
          <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground/70">
            {content}
          </div>
        )}
      </div>
    </FoldableSection>
  )
}

export default ThinkingSection
