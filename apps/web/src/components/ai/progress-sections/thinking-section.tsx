'use client'

import * as React from 'react'
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
 * - 折叠时:标题 "思考过程"
 * - 展开时:当前节点 + LLM 累积内容(可滚动,max-h-20)
 *
 * 数据来源:useAgentProgress.overview.content / currentNode
 * 注:后端如新增 reasoning 事件,可在此扩展
 */
export function ThinkingSection({ content, currentNode, isStreaming }: ThinkingSectionProps) {
  const hasContent = content.length > 0 || currentNode !== null
  if (!hasContent) return null

  return (
    <FoldableSection title="思考过程" data-testid="thinking-section">
      <div className="space-y-1 text-[11px] leading-relaxed">
        {currentNode && (
          <div className="text-primary">
            {isStreaming ? '正在' : ''}
            {currentNode}
          </div>
        )}
        {content && (
          <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground/80">
            {content}
          </div>
        )}
      </div>
    </FoldableSection>
  )
}

export default ThinkingSection
