// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { thinkingTitleView } from '@ihui/shared/chat/element-pack'
import { Tooltip } from '@/components/feedback'
import { StreamDetail, StreamRow } from '@/components/chat/stream/stream-ui'
import { splitReasoningSections } from '@/lib/reasoning-sections'

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
   * 2026-08-29 立:思考仍在增长指示 — 正文流式输出期间 reasoning 交错到达
   * (isStreaming 已收紧为 false,但思考内容仍在增长)。
   * 展开态显示脉冲光标、折叠态显示"思考中"loader,流结束后自动消失。
   */
  isGrowing?: boolean
  /**
   * Phase 22: 受控模式 — 外部传入 expanded 值时优先使用,不读/写 localStorage。
   * 不传则走非受控模式(内部 state + localStorage 持久化)。
   */
  expanded?: boolean
  /** 受控模式下的 toggle 回调 */
  onToggle?: () => void
  /**
   * D64 ③(2026-09-24 立):本轮**引用数**。无思考内容却有引用时,标题走
   * 「使用了 {count} 个引用」双态;不传(或 0/非法)则维持「有思考才渲染」的现状口径。
   * 判定在 `@ihui/shared/chat/element-pack#thinkingTitleView`,端内不另写第二套。
   */
  refsCount?: number
  /**
   * 「使用了 N 个引用」态的展开体:**由调用方注入**(同 D72 WorktreeCard 的"不取数"纪律)。
   * 思考卡自己不认识引用数据,也不复制一份列表 —— 调用方把既有 `CitationBar` 传进来,
   * 引用集合仍只有消息级 `m.citations` 一个真相源。无思考却有引用时,标题即该 slot 的计数。
   */
  refsSlot?: React.ReactNode
}

/**
 * ThinkingSection — 思考过程折叠子区(对标 AI 工作台,2026-07-28 v2)
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
 * v2 改动(对标 AI 工作台,2026-07-28):
 * - 移除 FoldableSection 包装,自渲染 header(支持 preview/duration 嵌入)
 * - 折叠态展示内容预览 + 耗时,降低信息密度但保留关键状态
 * - 展开态升级为代码块样式 + 复制按钮
 * - 所有 i18n key 通过 ai.pane 命名空间访问(5 语言 parity)
 */
export const ThinkingSection = React.memo(function ThinkingSection({
  content,
  currentNode,
  isStreaming,
  isGrowing = false,
  refsCount,
  refsSlot,
  expanded: controlledExpanded,
  onToggle,
}: ThinkingSectionProps) {
  const t = useTranslations('ai.pane')

  // Phase 22: 受控模式(传 controlledExpanded)优先;非受控模式用内部 state + localStorage
  const isControlled = typeof controlledExpanded === 'boolean'
  const [internalExpanded, setInternalExpanded] = React.useState<boolean>(false)
  // 2026-08-29:自动展开/收起生命周期(仅非受控模式,与 MessageItem 受控逻辑对齐)
  // - 流式时自动展开;流式结束后若为自动展开(用户未手动 toggle 过)则自动收起
  // - autoExpandedRef 标记"本次展开是自动的",手动 toggle 时清除
  const autoExpandedRef = React.useRef<boolean>(false)

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
    autoExpandedRef.current = false // 手动操作后不再自动收起
    setInternalExpanded((prev) => {
      const next = !prev
      saveExpandedToStorage(next)
      return next
    })
  }, [isControlled, onToggle])

  // v2: 思考耗时(从 mount 开始累积,流式时每秒 tick;2026-08-29:交错增长期同样 tick)
  const startTimeRef = React.useRef<number>(Date.now())
  const [elapsedMs, setElapsedMs] = React.useState<number>(0)
  const thinkingActive = isStreaming || isGrowing
  React.useEffect(() => {
    if (!thinkingActive) return
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current)
    }, 500)
    return () => window.clearInterval(id)
  }, [thinkingActive])

  // v2: 内容预览(折叠时显示最后 60 字符,合并空白)
  const preview = React.useMemo<string>(() => {
    if (content.length === 0) return ''
    const trimmed = content.replace(/\s+/g, ' ').trim()
    return trimmed.length > 60 ? `…${trimmed.slice(-60)}` : trimmed
  }, [content])

  // P3 #33(2026-09-16 立):reasoning 分节(对标 Codex reasoning sections)。
  // 按空行切段、显式 markdown 标题优先、隐式取首行截断;短内容退化为无标题单节。
  const sections = React.useMemo(() => splitReasoningSections(content), [content])

  // v2: 复制状态
  const [copied, setCopied] = React.useState<boolean>(false)
  // P3 #33:容器由 <pre> 改为分节 <div>,ref 同步换型(自动滚动用,scrollTop/scrollHeight 通用)
  const preRef = React.useRef<HTMLDivElement>(null)

  // 流式输出时自动展开
  // D64 ③(H22 反超判据):**已经展开**(含用户手动展开 / localStorage 恢复的偏好)时
  // 不接管 —— 否则流结束会把用户自己点开的内容收回去。只有"这次是自动展开的"才允许自动收起。
  React.useEffect(() => {
    if (isStreaming && !isControlled && !expanded) {
      autoExpandedRef.current = true
      setInternalExpanded(true)
    }
  }, [isStreaming, isControlled, expanded])

  // 流式结束后自动收起(不写 localStorage,保留用户跨会话的持久化偏好)
  React.useEffect(() => {
    if (!isStreaming && !isControlled && autoExpandedRef.current) {
      autoExpandedRef.current = false
      setInternalExpanded(false)
    }
  }, [isStreaming, isControlled])

  // 2026-08-29:交错增长期间展开态同样自动滚动到底部
  React.useEffect(() => {
    if (!thinkingActive || !expanded) return
    const el = preRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [content, thinkingActive, expanded])

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

  // D64 ③(2026-09-24):双态标题 —— 判定在共享层 thinkingTitleView,端内只渲染。
  // 无思考内容但有引用 → 「使用了 {count} 个引用」;两者皆无 → 整段不渲染(与现状同口径)。
  const hasThinking = content.length > 0 || currentNode !== null
  const titleView = thinkingTitleView(hasThinking, refsCount)
  if (!titleView) return null
  const titleText = titleView.values
    ? t(titleView.titleKey, titleView.values)
    : t(titleView.titleKey)

  return (
    <div
      className="mt-1 transition-colors"
      data-testid="thinking-section"
      data-thinking-state={isStreaming ? 'streaming' : 'idle'}
      // 2026-08-29:交错增长指示(供单测/e2e 断言)
      data-thinking-growing={isGrowing ? 'true' : 'false'}
      data-thinking-expanded={expanded ? 'true' : 'false'}
      data-thinking-title-variant={titleView.variant}
    >
      {/* 2026-09-21:思考行并入消息流活动行基元 —— 与工具行/步骤行同一字号、同一状态图标、
          同一"标题 · 预览 ……… 耗时 ›"信息排布,不再自成一套 text-sm 头部 */}
      <StreamRow
        status={thinkingActive ? 'running' : 'success'}
        title={titleText}
        subject={expanded ? undefined : preview}
        subjectKind="none"
        tags={currentNode ? [currentNode] : undefined}
        elapsedMs={!expanded && elapsedMs > 500 ? elapsedMs : undefined}
        trailing={
          thinkingActive && !expanded ? (
            // 折叠态也要把"思考中"播报给读屏用户(行内状态图标对 SR 不可见)
            <span aria-live="polite" data-testid="thinking-loader">
              {t('thinkingStreaming')}
            </span>
          ) : expanded && content.length > 0 ? (
            <Tooltip content={t('thinkingCharCountTitle', { n: content.length })}>
              <span className="tabular-nums" data-testid="thinking-char-count">
                {content.length} {t('thinkingChars')}
              </span>
            </Tooltip>
          ) : undefined
        }
        onClick={handleToggle}
        expanded={expanded}
        sectionHeader
        ariaLabel={titleText}
        className={thinkingActive ? 'text-shimmer' : undefined}
        testId="thinking-toggle"
      />
      {/* v2: 展开态内容区(代码块样式);P3 #33:按节渲染 + 小标题 */}
      {hasThinking && expanded && (
        <StreamDetail className="relative" testId="thinking-content-wrapper">
          {content && (
            <div
              ref={preRef}
              className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-foreground/75"
              aria-live={thinkingActive ? 'polite' : undefined}
              aria-atomic={thinkingActive ? 'false' : undefined}
              data-testid="thinking-content"
            >
              {sections.map((s, i) => (
                <div key={i} className={i > 0 ? 'mt-2' : ''} data-testid={`thinking-section-${i}`}>
                  {s.title && (
                    <div
                      className="mb-0.5 text-[11px] font-medium text-foreground/85"
                      data-testid={`thinking-section-title-${i}`}
                    >
                      {s.title}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-all">
                    {s.body}
                    {/* 2026-08-29:流式/交错增长期脉冲光标(思考仍在输出),内联在最后节正文末尾 */}
                    {thinkingActive && i === sections.length - 1 && (
                      <span
                        className="ml-0.5 inline-block w-0.5 animate-pulse bg-primary/50 align-middle"
                        style={{ height: '10px' }}
                        aria-hidden
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {content && (
            <Tooltip content={copied ? t('copied') : t('copyThinking')}>
              <button
                type="button"
                onClick={onCopy}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground/50 transition-colors hover:text-foreground/70 focus-visible:outline-none"
                aria-label={copied ? t('copied') : t('copyThinking')}
                data-testid="thinking-copy-btn"
                data-copied={copied ? 'true' : undefined}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </Tooltip>
          )}
        </StreamDetail>
      )}
      {/* D64③ 第二态:无思考内容但有引用 —— 展开体是调用方注入的引用 slot
          (卡片不认识引用数据,也不复制列表;标题上的计数与 slot 同一集合) */}
      {!hasThinking && expanded && refsSlot ? (
        <StreamDetail testId="thinking-refs-wrapper">{refsSlot}</StreamDetail>
      ) : null}
    </div>
  )
})

export default ThinkingSection
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
