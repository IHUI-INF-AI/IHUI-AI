'use client'

import * as React from 'react'
import { Brain, Loader2, Copy, Check } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/feedback'
import { formatDuration } from './foldable-section'

// Phase 22: localStorage key(ihui: 命名空间)
const STORAGE_KEY = 'ihui:thinking-expanded'

/** 从 localStorage 读取折叠状态,SSR 安全(只在 useEffect 调用) */
function loadExpandedFromStorage(): boolean | null {
  try {
    if (typeof window === 'undefined') return null
    const val = window.localStorage.getItem(STORAGE_KEY)
    if (val === 'true') return true
    if (val === 'false') return false
    return null
  } catch {
    return null // 隐私模式 / 存储不可用
  }
}

/** 写入折叠状态到 localStorage,静默失败 */
function saveExpandedToStorage(expanded: boolean): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, String(expanded))
  } catch {
    // 静默失败(隐私模式 / 存储已满)
  }
}

interface ThinkingSectionProps {
  /** LLM 累积输出内容(来自 token 事件) */
  content: string
  /** 当前执行节点名(来自 node_start 事件) */
  currentNode: string | null
  /** 是否正在流式输出 */
  isStreaming: boolean
  /**
   * Phase 22: 受控模式 — 外部传入 expanded 值时优先使用,不读/写 localStorage。
   * 不传则走非受控模式(内部 state + localStorage 持久化)。
   */
  expanded?: boolean
  /** 受控模式下的 toggle 回调 */
  onToggle?: () => void
}

/**
 * ThinkingSection — 思考过程折叠子区(对标 Trae Work,2026-07-28 v2)
 *
 * 折叠时(默认):
 * - Brain 图标 + "思考过程" 标题
 * - 当前节点 badge(若有)
 * - 流式时显示 "思考中..." loader + 旋转 spinner
 * - 内容预览(最后 60 字符截断,保持 1 行高度)
 * - 已耗时(从开始累积,流式时实时 tick)
 *
 * 展开时:
 * - 完整思考内容(代码块样式 + 等宽字体 + max-h-32 滚动)
 * - 字符计数(右上角,只读)
 * - 复制按钮(右上一键复制全部内容,带 1.5s "已复制" 反馈)
 * - 流式时末尾 闪烁光标
 *
 * v2 改动(对标 Trae Work,2026-07-28):
 * - 移除 FoldableSection 包装,自渲染 header(支持 preview/duration 嵌入)
 * - 折叠态展示内容预览 + 耗时,降低信息密度但保留关键状态
 * - 展开态升级为代码块样式 + 复制按钮
 * - 所有 i18n key 通过 ai.pane 命名空间访问(5 语言 parity)
 */
export const ThinkingSection = React.memo(function ThinkingSection({
  content,
  currentNode,
  isStreaming,
  expanded: controlledExpanded,
  onToggle,
}: ThinkingSectionProps) {
  const t = useTranslations('ai.pane')

  // Phase 22: 受控模式(传 controlledExpanded)优先;非受控模式用内部 state + localStorage
  const isControlled = typeof controlledExpanded === 'boolean'
  const [internalExpanded, setInternalExpanded] = React.useState<boolean>(false)

  // SSR 安全:localStorage 只在 useEffect 中读,不在 render 阶段访问
  React.useEffect(() => {
    if (isControlled) return
    const stored = loadExpandedFromStorage()
    if (stored !== null) setInternalExpanded(stored)
  }, [isControlled])

  const expanded = isControlled ? (controlledExpanded as boolean) : internalExpanded

  // Phase 22: 非受控模式 toggle 时持久化到 localStorage
  const handleToggle = React.useCallback(() => {
    if (isControlled) {
      onToggle?.()
      return
    }
    setInternalExpanded((prev) => {
      const next = !prev
      saveExpandedToStorage(next)
      return next
    })
  }, [isControlled, onToggle])

  // v2: 思考耗时(从 mount 开始累积,流式时每秒 tick)
  const startTimeRef = React.useRef<number>(Date.now())
  const [elapsedMs, setElapsedMs] = React.useState<number>(0)
  React.useEffect(() => {
    if (!isStreaming) return
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 500)
    return () => window.clearInterval(id)
  }, [isStreaming])

  // v2: 内容预览(折叠时显示最后 60 字符,合并空白)
  const preview = React.useMemo<string>(() => {
    if (content.length === 0) return ''
    const trimmed = content.replace(/\s+/g, ' ').trim()
    return trimmed.length > 60 ? `…${trimmed.slice(-60)}` : trimmed
  }, [content])

  // v2: 复制状态
  const [copied, setCopied] = React.useState<boolean>(false)
  const preRef = React.useRef<HTMLPreElement>(null)

  // 流式输出时自动展开 + 自动滚动到底部
  React.useEffect(() => {
    if (isStreaming && !isControlled) {
      setInternalExpanded(true)
    }
  }, [isStreaming, isControlled])

  React.useEffect(() => {
    if (!isStreaming || !expanded) return
    const el = preRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [content, isStreaming, expanded])

  const onCopy = React.useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        const id = window.setTimeout(() => setCopied(false), 1500)
        return () => window.clearTimeout(id)
      }
    } catch {
      // 忽略剪贴板权限错误
    }
    return undefined
  }, [content])

  const hasContent = content.length > 0 || currentNode !== null
  if (!hasContent) return null

  return (
    <div
      className="mt-1.5 rounded-sm border border-border/30 bg-muted/15 transition-colors"
      data-testid="thinking-section"
      data-thinking-state={isStreaming ? 'streaming' : 'idle'}
      data-thinking-expanded={expanded ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label={t('thinkingTitle')}
        data-section-header="true"
        data-testid="thinking-toggle"
        className="flex w-full items-center gap-1 px-2 py-0.5 text-left text-[11px] font-medium text-muted-foreground/80 transition-colors hover:bg-accent/30 hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 focus-visible:ring-offset-0"
      >
        <ChevronRight
          className={cn(
            'h-2.5 w-2.5 shrink-0 text-muted-foreground/50 transition-transform duration-150',
            expanded && 'rotate-90',
          )}
          aria-hidden
        />
        <Brain className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" aria-hidden />
        <span className="shrink-0">{t('thinkingTitle')}</span>
        {currentNode && (
          <span
            className="inline-flex shrink-0 items-center rounded-sm bg-primary/8 px-1 py-0.5 text-[10px] font-medium text-primary/80"
            data-testid="thinking-current-node"
          >
            {currentNode}
          </span>
        )}
        {/* v2: 折叠态流式 loader(对标 Trae Work "思考中...") */}
        {isStreaming && !expanded && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-primary/70"
            data-testid="thinking-loader"
            aria-live="polite"
          >
            <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden />
            <span>{t('thinkingStreaming')}</span>
          </span>
        )}
        {/* v2: 折叠态内容预览(1 行高度,最后 60 字符) */}
        {!expanded && preview && (
          <span
            className="min-w-0 flex-1 truncate text-[10px] font-normal text-muted-foreground/50 transition-all duration-150"
            data-testid="thinking-preview"
          >
            {preview}
          </span>
        )}
        {/* v2: 折叠态耗时(从 mount 累积,>500ms 才显示) */}
        {!expanded && elapsedMs > 500 && (
          <Tooltip content={t('thinkingElapsedTitle', { time: formatDuration(elapsedMs) })}>
            <span
              className="shrink-0 tabular-nums text-[10px] text-muted-foreground/45"
              data-testid="thinking-elapsed"
            >
              {formatDuration(elapsedMs)}
            </span>
          </Tooltip>
        )}
        {/* 展开态:字符数提示(右上角) */}
        {expanded && content.length > 0 && (
          <Tooltip content={t('thinkingCharCountTitle', { n: content.length })}>
            <span
              className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/45"
              data-testid="thinking-char-count"
            >
              {content.length} {t('thinkingChars')}
            </span>
          </Tooltip>
        )}
      </button>
      {/* v2: 展开态内容区(代码块样式) */}
      {hasContent && expanded && (
        <div
          className="px-2 pb-1 pt-0.5"
          data-testid="thinking-content-wrapper"
        >
          <div className="relative">
            {content && (
              <pre
                ref={preRef}
                className="max-h-28 overflow-y-auto whitespace-pre-wrap break-all rounded-sm bg-muted/20 p-1.5 pr-7 font-mono text-[10.5px] leading-relaxed text-foreground/70"
                aria-live={isStreaming ? 'polite' : undefined}
                aria-atomic={isStreaming ? 'false' : undefined}
                data-testid="thinking-content"
              >
                {content}
                {isStreaming && (
                  <span
                    className="ml-0.5 inline-block w-0.5 animate-pulse bg-primary/50 align-middle"
                    style={{ height: '10px' }}
                    aria-hidden
                  />
                )}
              </pre>
            )}
            {content && (
              <Tooltip content={copied ? t('copied') : t('copyThinking')}>
                <button
                  type="button"
                  onClick={onCopy}
                  className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:bg-accent/30 hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
                  aria-label={copied ? t('copied') : t('copyThinking')}
                  data-testid="thinking-copy-btn"
                  data-copied={copied ? 'true' : undefined}
                >
                  {copied ? (
                    <Check className="h-2.5 w-2.5 text-emerald-500" aria-hidden />
                  ) : (
                    <Copy className="h-2.5 w-2.5" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default ThinkingSection
