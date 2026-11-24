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
import type { ReasoningSection } from '@/lib/reasoning-sections'

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

/**
 * 2026-11-15 流式优化:单节渲染抽成 React.memo 子组件。
 *
 * 旧写法在 ThinkingSection 每帧重渲染时,sections.map 对**全部**节重建 React 元素树
 * (包括早已冻结的前缀节)。配合 thinkingContent 里对 sections 数组做的"稳定前缀引用
 * 复用"(:see splitReasoningSectionsStable),前缀节的 ReasoningSection 对象引用不变
 * ⇒ 这里 memo 浅比较命中 ⇒ 整节跳过重渲染,流式追加时每帧只重渲染正在生长的末节。
 *
 * 光标只在末节显示(见下方 isLast prop),前缀节无光标逻辑,纯文本 + 标题,可安全 memo。
 */
const ReasoningSectionView = React.memo(function ReasoningSectionView({
  section,
  index,
  isLast,
  showCursor,
}: {
  section: ReasoningSection
  index: number
  isLast: boolean
  showCursor: boolean
}) {
  return (
    <div className={index > 0 ? 'mt-2' : ''} data-testid={`thinking-section-${index}`}>
      {section.title && (
        <div
          className="mb-0.5 text-[11px] font-medium text-foreground/85"
          data-testid={`thinking-section-title-${index}`}
        >
          {section.title}
        </div>
      )}
      <div className="whitespace-pre-wrap break-all">
        {section.body}
        {showCursor && isLast && (
          <span
            className="ml-0.5 inline-block w-0.5 animate-cursor-blink bg-primary/60 align-middle motion-reduce:animate-none"
            style={{ height: '10px' }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
})

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
 * ThinkingSection — 思考过程折叠子区(对齐 AI 工作台,2026-07-28 v2)
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
 * v2 改动(对齐 AI 工作台,2026-07-28):
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

  // P3 #33(2026-09-16 立):reasoning 分节(遵循统一工程规范)。
  // 按空行切段、显式 markdown 标题优先、隐式取首行截断;短内容退化为无标题单节。
  //
  // 2026-11-15 流式优化:稳定前缀引用复用。
  // splitReasoningSections 每帧对全文重切返回**全新对象数组** ⇒ 即使前缀段落未变,
  // 每节都是新对象引用 ⇒ 下方 ReasoningSectionView 的 React.memo 全部失效、每帧重渲染全部节。
  // 修法:记住上一帧 sections 数组,新结果若前缀节内容相同(title + body === 值相等)则复用旧引用。
  // reasoning 是纯追加流 ⇒ 已成型的段落永不变化,只有末段在生长 ⇒ 稳定帧全部前缀节 memo 命中。
  const prevSectionsRef = React.useRef<ReasoningSection[]>([])
  const sections = React.useMemo(() => {
    const next = splitReasoningSections(content)
    const prev = prevSectionsRef.current
    // 前缀节数量 = min(prev.length, next.length);逐节比对,内容相同则复用旧引用。
    // 末节(body 在生长)与新增节保持新引用(内容确实变了,需要重渲染)。
    const reused = next.map((section, i) => {
      if (i < prev.length && prev[i]!.title === section.title && prev[i]!.body === section.body) {
        return prev[i]!
      }
      return section
    })
    prevSectionsRef.current = reused
    return reused
  }, [content])

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
      className="mt-0 transition-colors"
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
        kind="thinking"
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
              /* 2026-10-28 观感档:思考视口 200px → 320px(遵循统一工程规范)。
                 旧档一屏只容 ~10 行,长思考的"边生成边读"退化成窥管;尾随滚动(上方 effect)
                 与滚动容器形态不变,只扩可读纵深。 */
              className="max-h-[320px] overflow-y-auto whitespace-pre-wrap break-all text-label leading-relaxed text-foreground/75"
              aria-live={thinkingActive ? 'polite' : undefined}
              aria-atomic={thinkingActive ? 'false' : undefined}
              data-testid="thinking-content"
            >
              {sections.map((s, i) => (
                // 2026-11-15 流式优化:改用 ReasoningSectionView(memo),配合下方 sections
                // 的稳定前缀引用复用,前缀节 memo 命中跳过重渲染,每帧只重渲染末节。
                <ReasoningSectionView
                  key={i}
                  section={s}
                  index={i}
                  isLast={i === sections.length - 1}
                  showCursor={thinkingActive}
                />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
