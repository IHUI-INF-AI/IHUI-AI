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
 *
 * v10 memo:React.memo 包装,content/currentNode/isStreaming 引用稳定时跳过重渲染
 */
export const ThinkingSection = React.memo(function ThinkingSection({
  content,
  currentNode,
  isStreaming,
}: ThinkingSectionProps) {
  const hasContent = content.length > 0 || currentNode !== null
  if (!hasContent) return null

  // v12: 渐显新内容 — 记忆上次内容长度,新追加部分包 span + animation,完成后回归正常色
  const [prevLen, setPrevLen] = React.useState(content.length)
  const [fadeKey, setFadeKey] = React.useState(0)
  React.useEffect(() => {
    if (content.length > prevLen) {
      setFadeKey((k) => k + 1)
      const t = window.setTimeout(() => setPrevLen(content.length), 600)
      return () => window.clearTimeout(t)
    }
    if (content.length < prevLen) {
      setPrevLen(content.length)
    }
    return undefined
  }, [content, prevLen])
  const appendedSlice = content.slice(prevLen)

  return (
    <FoldableSection title="思考过程" icon={Brain} data-testid="thinking-section">
      <div
        className="space-y-1 text-[11px] leading-relaxed"
        aria-live={isStreaming ? 'polite' : undefined}
        aria-atomic={isStreaming ? 'false' : undefined}
      >
        {currentNode && (
          <div className="flex items-center gap-1">
            {isStreaming && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />}
            <span className="inline-flex items-center rounded-sm bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
              {currentNode}
            </span>
          </div>
        )}
        {content && (
          <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-all text-muted-foreground/70">
            {content.slice(0, prevLen)}
            {appendedSlice && (
              <span
                key={fadeKey}
                className="animate-fade-in-highlight text-foreground"
                style={{
                  animation: 'fadeInHighlight 600ms ease-out forwards',
                }}
              >
                {appendedSlice}
              </span>
            )}
            {isStreaming && (
              <span
                className="ml-0.5 inline-block w-0.5 animate-pulse bg-primary/60 align-middle"
                style={{ height: '10px' }}
                aria-hidden
              />
            )}
          </div>
        )}
      </div>
    </FoldableSection>
  )
})

export default ThinkingSection
