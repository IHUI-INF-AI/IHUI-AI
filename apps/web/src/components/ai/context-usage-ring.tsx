// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { ChevronDown, ChevronRight, Loader2, Minimize2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { cn } from '@/lib/utils'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { IconButton } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { createPortal } from 'react-dom'
import { useChatStore } from '@/stores/chat'
import { compressConversation } from '@ihui/api-client'
import { getModelContextCapacity, formatTokenCount } from '@/lib/model-context-capacity'
import {
  LABEL_SENTINELS,
  computeContextAttribution,
  formatShare,
  type AttributionDetail,
  type AttributionKey,
  type AttributionMessage,
} from '@ihui/shared/utils/context-attribution'

/** 层栈 id(见 @/lib/overlay-stack):本弹层的 Esc 只在栈顶时被消费 */
const CONTEXT_USAGE_OVERLAY_ID = 'context-usage-ring'

// ============================================================================
// 圆环尺寸常量
// ============================================================================

/** 标题栏小圆环(trigger):24x24 viewBox,r=10,stroke=2.5 */
const TRIGGER_SIZE = 24
const TRIGGER_STROKE = 2.5
const TRIGGER_R = (TRIGGER_SIZE - TRIGGER_STROKE) / 2 // 10.75
const TRIGGER_CIRC = 2 * Math.PI * TRIGGER_R

/** 弹窗内大圆环:80x80 viewBox,r=34,stroke=6 */
const PANEL_SIZE = 80
const PANEL_STROKE = 6
const PANEL_R = (PANEL_SIZE - PANEL_STROKE) / 2 // 37
const PANEL_CIRC = 2 * Math.PI * PANEL_R

// ============================================================================
// 使用率分级 → 颜色
// ============================================================================

type UsageLevel = 'low' | 'medium' | 'high' | 'critical'

interface UsageStyle {
  /** Tailwind stroke 类(SVG stroke 用 currentColor,容器 text-* 控制颜色) */
  text: string
  bg: string
  label: 'lowUsage' | 'mediumUsage' | 'highUsage' | 'criticalUsage'
}

const USAGE_STYLES: Record<UsageLevel, UsageStyle> = {
  low: { text: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'lowUsage' },
  medium: { text: 'text-amber-500', bg: 'bg-amber-500/10', label: 'mediumUsage' },
  high: { text: 'text-orange-500', bg: 'bg-orange-500/10', label: 'highUsage' },
  critical: { text: 'text-red-500', bg: 'bg-red-500/10', label: 'criticalUsage' },
}

function getUsageLevel(ratio: number): UsageLevel {
  if (ratio >= 0.95) return 'critical'
  if (ratio >= 0.8) return 'high'
  if (ratio >= 0.5) return 'medium'
  return 'low'
}

// ============================================================================
// 上下文占用归因分解(按构成来源,而非只报总量)
// ============================================================================

/**
 * 七档构成来源 → 占比色 + 词表键。
 *
 * 词表键一律是 `chat.contextUsage` 下的静态字面量(守门要求 useTranslations 的
 * 命名空间/键可静态解析),所以这里显式列出联合类型而不是拼字符串。
 */
type SegmentLabelKey =
  | 'segSystem'
  | 'segToolSchema'
  | 'segSkill'
  | 'segRoleUser'
  | 'segRoleAssistant'
  | 'segRoleToolCall'
  | 'segRoleToolResult'

const SEGMENT_META: Record<AttributionKey, { colorClass: string; labelKey: SegmentLabelKey }> = {
  system: { colorClass: 'bg-sky-500', labelKey: 'segSystem' },
  toolSchema: { colorClass: 'bg-amber-500', labelKey: 'segToolSchema' },
  skill: { colorClass: 'bg-fuchsia-500', labelKey: 'segSkill' },
  roleUser: { colorClass: 'bg-emerald-500', labelKey: 'segRoleUser' },
  roleAssistant: { colorClass: 'bg-teal-500', labelKey: 'segRoleAssistant' },
  roleToolCall: { colorClass: 'bg-orange-500', labelKey: 'segRoleToolCall' },
  roleToolResult: { colorClass: 'bg-violet-500', labelKey: 'segRoleToolResult' },
}

/** 工具结果体落盘形态不一(字符串 / 对象 / 尚未回传),统一成文本再交给归因引擎 */
function resultTextOf(result: unknown): string | undefined {
  if (result === undefined || result === null) return undefined
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result) ?? undefined
  } catch {
    return undefined
  }
}

/** store 的 ChatMessage → 归因引擎入参(只取归因需要的字段,避免耦合) */
function toAttributionMessages(
  messages: Array<{
    role: string
    content: string
    error?: boolean
    toolCalls?: Array<{
      toolName?: string
      args?: Record<string, unknown>
      /** 成功结果体:类型是 unknown,归因引擎只吃文本,故在下方字符串化 */
      result?: unknown
      /** 失败原因(与成功结果体互斥落盘) */
      error?: string
    }>
  }>,
): AttributionMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content ?? '',
    error: m.error,
    toolCalls: m.toolCalls?.map((tc) => ({
      toolName: tc.toolName,
      args: tc.args,
      // 成功结果体**必须**计入占用:一次 read_file 动辄几十 KB,是窗口里最大的一块。
      // 此前只把 error 传下去 ⇒ 成功的结果被算成 0,恰好把最该看见的东西藏掉。
      result: resultTextOf(tc.result),
      // 工具结果体挂在 error 上时(失败态)同样要计入占用,否则失败被隐形
      error: tc.error,
    })),
  }))
}

/**
 * 明细行的可读文本。
 *
 * 优先级:哨兵键 → 词表;正文类明细 → **尾部**摘录(头部往往是他粘贴的正文
 * 或滚了半屏的日志,结尾才是这一条真正的信息量:提问、失败原因);
 * 名字类明细(工具名 / 技能名)无尾部 ⇒ 回退 label。
 */
function useDetailLabelTranslator() {
  const t = useTranslations('chat.contextUsage')
  return React.useCallback(
    (detail: AttributionDetail): string => {
      if (detail.label === LABEL_SENTINELS.systemPrompt) return t('segSystemPrompt')
      if (detail.label === LABEL_SENTINELS.unnamed) return t('unnamedItem')
      const preview = detail.tailPreview ?? detail.label
      if (detail.kind === 'result') return `${preview || t('unnamedItem')} · ${t('resultSuffix')}`
      return preview || t('unnamedItem')
    },
    [t],
  )
}

// ============================================================================
// 小圆环 trigger
// ============================================================================

interface TriggerRingProps {
  ratio: number
  usedTokens: number
  maxTokens: number
}

function TriggerRing({ ratio, usedTokens, maxTokens }: TriggerRingProps) {
  const t = useTranslations('chat.contextUsage')
  const level = getUsageLevel(ratio)
  const style = USAGE_STYLES[level]
  // ratio > 1 时 clamp 到 1,但中心数字仍显示真实百分比(警示超限)
  const progressRatio = Math.min(ratio, 1)
  const offset = TRIGGER_CIRC * (1 - progressRatio)
  const percent = Math.round(ratio * 100)

  return (
    <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent">
      <svg
        width={TRIGGER_SIZE}
        height={TRIGGER_SIZE}
        viewBox={`0 0 ${TRIGGER_SIZE} ${TRIGGER_SIZE}`}
        className={style.text}
        // 图形本身是装饰:环 + 中心数字的语义由下面的 sr-only 口径承担
        aria-hidden="true"
      >
        {/* 背景圆环 */}
        <circle
          cx={TRIGGER_SIZE / 2}
          cy={TRIGGER_SIZE / 2}
          r={TRIGGER_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={TRIGGER_STROKE}
          className="opacity-20"
        />
        {/* 进度圆环:从顶部 12 点位置开始,逆时针减少 */}
        <circle
          cx={TRIGGER_SIZE / 2}
          cy={TRIGGER_SIZE / 2}
          r={TRIGGER_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={TRIGGER_STROKE}
          strokeLinecap="round"
          strokeDasharray={TRIGGER_CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${TRIGGER_SIZE / 2} ${TRIGGER_SIZE / 2})`}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
        {/* 中心百分比数字:SVG text + dominantBaseline=central 像素级精确居中,
            避开 HTML flex items-center 受字体 ascent/descent 不对称影响导致的偏移 */}
        <text
          x={TRIGGER_SIZE / 2}
          y={TRIGGER_SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="8"
          fontWeight="600"
          className="fill-foreground"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percent}
        </text>
      </svg>
      {/* 口径:环中心只有一个数字,数值含义(占窗口多少、分子分母分别是什么)
          由这段仅供读屏/文本读取的说明承载。此前这里写的是裸 "used / max",
          既没有百分比口径,也没有单位 —— 等于把口径藏在一个最不被读到的位置。 */}
      <span className="sr-only">
        {t('ringBasis', {
          percent: String(percent),
          used: formatTokenCount(usedTokens),
          max: formatTokenCount(maxTokens),
        })}
      </span>
    </span>
  )
}

// ============================================================================
// 大圆环(弹窗内)
// ============================================================================

interface PanelRingProps {
  ratio: number
  usedTokens: number
  maxTokens: number
}

function PanelRing({ ratio, usedTokens, maxTokens }: PanelRingProps) {
  const t = useTranslations('chat.contextUsage')
  const level = getUsageLevel(ratio)
  const style = USAGE_STYLES[level]
  const progressRatio = Math.min(ratio, 1)
  const offset = PANEL_CIRC * (1 - progressRatio)
  const percent = Math.round(ratio * 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={PANEL_SIZE}
          height={PANEL_SIZE}
          viewBox={`0 0 ${PANEL_SIZE} ${PANEL_SIZE}`}
          className={style.text}
        >
          <circle
            cx={PANEL_SIZE / 2}
            cy={PANEL_SIZE / 2}
            r={PANEL_R}
            fill="none"
            stroke="currentColor"
            strokeWidth={PANEL_STROKE}
            className="opacity-15"
          />
          <circle
            cx={PANEL_SIZE / 2}
            cy={PANEL_SIZE / 2}
            r={PANEL_R}
            fill="none"
            stroke="currentColor"
            strokeWidth={PANEL_STROKE}
            strokeLinecap="round"
            strokeDasharray={PANEL_CIRC}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${PANEL_SIZE / 2} ${PANEL_SIZE / 2})`}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
          {/* 中心百分比:SVG text 精确居中 */}
          <text
            x={PANEL_SIZE / 2}
            y={PANEL_SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="16"
            fontWeight="600"
            className="fill-foreground"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {percent}%
          </text>
        </svg>
      </div>
      <span className={cn('rounded-sm px-2 py-0.5 text-[10px] font-medium', style.bg, style.text)}>
        {t(style.label)}
      </span>
      <div className="text-center text-xs text-muted-foreground">
        <span className="tabular-nums text-foreground">{formatTokenCount(usedTokens)}</span>
        <span className="mx-1">/</span>
        <span className="tabular-nums">{formatTokenCount(maxTokens)}</span>
      </div>
    </div>
  )
}

// ============================================================================
// 主组件
// ============================================================================

interface ContextUsageRingProps {
  /** 当前模型 id */
  model: string
  /** 是否正在流式输出(流式中禁用压缩按钮) */
  isStreaming?: boolean
}

export function ContextUsageRing({ model, isStreaming = false }: ContextUsageRingProps) {
  const t = useTranslations('chat.contextUsage')
  const messages = useChatStore((s) => s.messages)
  const conversationId = useChatStore((s) => s.conversationId)
  const usageByMessageId = useChatStore((s) => s.usageByMessageId)
  const translateDetail = useDetailLabelTranslator()

  const maxTokens = React.useMemo(() => getModelContextCapacity(model), [model])

  /**
   * 归因分解:由本地按构成来源自己算(不取 provider 估算做分解)。
   * provider 回传的 promptTokens 只用来**校准总量**并算出未归类差额 ——
   * 它只有一个总数,给不出"是谁占满的"。
   *
   * 系统提示 / 工具 schema / 技能正文三档在服务端装配,浏览器端拿不到,
   * 引擎会把它们标 observed=false 而不是记 0(见 shared/context-attribution)。
   */
  const attribution = React.useMemo(() => {
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && !m.error && m.content)
    const providerUsage = lastAssistant ? usageByMessageId[lastAssistant.id] : undefined
    return computeContextAttribution({
      messages: toAttributionMessages(messages),
      providerPromptTokens: providerUsage?.promptTokens ?? null,
      // 后端 usage 帧当前不携带缓存读数 —— 显式传 null 让 UI 如实显示"不可得",
      // 不得用 0 顶替(0 会被读成"一次都没命中",那是另一个结论)。
      cacheReadTokens: null,
      cacheWriteTokens: null,
    })
  }, [messages, usageByMessageId])

  const usedTokens = attribution.totalTokens
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 0
  const messageCount = messages.filter(
    (m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content,
  ).length

  const [expandedKeys, setExpandedKeys] = React.useState<Record<string, boolean>>({})
  const toggleSegment = React.useCallback((key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const [compressing, setCompressing] = React.useState(false)
  const [compressResult, setCompressResult] = React.useState<{
    originalChars: number
    compressedChars: number
  } | null>(null)
  const [compressError, setCompressError] = React.useState<string | null>(null)

  const handleCompress = React.useCallback(
    async (targetChars: 200000 | 1000000) => {
      if (!conversationId || compressing || isStreaming) return
      setCompressing(true)
      setCompressError(null)
      setCompressResult(null)
      try {
        const res = await compressConversation(conversationId, targetChars)
        if (res.success && res.data) {
          setCompressResult({
            originalChars: res.data.originalChars,
            compressedChars: res.data.compressedChars,
          })
          toast.success(t('compressSuccess'), {
            description: t('compressResultDesc', {
              original: String(res.data.originalChars),
              compressed: String(res.data.compressedChars),
            }),
          })
        } else {
          setCompressError(res.error || t('compressFailed'))
          toast.error(t('compressFailed'), { description: res.error })
        }
      } catch (e) {
        const msg = (e as Error).message || t('compressFailed')
        setCompressError(msg)
        toast.error(t('compressFailed'), { description: msg })
      } finally {
        setCompressing(false)
      }
    },
    [conversationId, compressing, isStreaming, t],
  )

  const level = getUsageLevel(ratio)
  const style = USAGE_STYLES[level]
  // 2026-07-20 修:next-intl ICU 在调用 t() 时就校验 {percent} 变量,
  // 之前的 .replace 是在 t() 返回后客户端字符串替换,导致 SSR 报
  // FORMATTING_ERROR "context variable 'percent' was not provided"
  // 改为传 variables 给 t() 走 ICU 正确插值
  const triggerLabel = t('triggerLabel', {
    percent: String(Math.round(ratio * 100)),
    used: formatTokenCount(usedTokens),
    max: formatTokenCount(maxTokens),
  })

  const compressDisabled = !conversationId || compressing || isStreaming

  // 自定义弹层状态(2026-08-31:移除 Popover wrapper,改为 createPortal)
  const [isOpen, setIsOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)

  const updateCoords = React.useCallback(() => {
    if (!triggerRef.current || !panelRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const panelRect = panelRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8
    const VW = window.innerWidth

    let top = r.top - gap - panelRect.height
    let left = r.left

    if (left + panelRect.width > VW - pad) {
      left = VW - pad - panelRect.width
    }
    left = Math.max(pad, left)

    if (top < pad) {
      top = r.bottom + gap
    }
    top = Math.max(pad, top)

    setCoords({ top, left })
  }, [])

  React.useLayoutEffect(() => {
    if (!isOpen) return
    const id = window.requestAnimationFrame(() => {
      updateCoords()
    })
    return () => window.cancelAnimationFrame(id)
  }, [isOpen, updateCoords])

  React.useEffect(() => {
    if (!isOpen) return
    const throttledUpdate = () => {
      if (rafRef.current !== null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        updateCoords()
      })
    }

    window.addEventListener('scroll', throttledUpdate, { capture: true, passive: true })
    window.addEventListener('resize', throttledUpdate, { passive: true })

    const roTrigger =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (roTrigger && triggerRef.current) roTrigger.observe(triggerRef.current)

    const roPanel = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (roPanel && panelRef.current) roPanel.observe(panelRef.current)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', throttledUpdate, true)
      window.removeEventListener('resize', throttledUpdate)
      roTrigger?.disconnect()
      roPanel?.disconnect()
    }
  }, [isOpen, updateCoords])

  React.useEffect(() => {
    if (!isOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = triggerRef.current
      const contentEl = panelRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    // 层栈:本弹层打开即入栈为栈顶;Esc 只由栈顶消费(多层同时打开时不再一起关)
    pushOverlay(CONTEXT_USAGE_OVERLAY_ID)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isTopOverlay(CONTEXT_USAGE_OVERLAY_ID)) return
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      popOverlay(CONTEXT_USAGE_OVERLAY_ID)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen])

  return (
    <div>
      <Tooltip content={triggerLabel} side="top">
        <IconButton
          ref={triggerRef}
          onClick={() => setIsOpen((prev) => !prev)}
          // E2E 锚点(2026-09-14 补回):aria-label 是百分比动态插值,floating-panel-viewport
          // 等 e2e 需要稳定 testid 选中触发按钮
          data-testid="context-usage-trigger"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后
          // 焦点环常驻(此文件未显式 triggerRef.focus 归还,但 click-outside 关闭后 trigger
          // 仍可能短暂持有焦点,加 data-state 是零成本防御)。
          data-state={isOpen ? 'open' : 'closed'}
        >
          <TriggerRing ratio={ratio} usedTokens={usedTokens} maxTokens={maxTokens} />
        </IconButton>
      </Tooltip>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            // z-popover(2026-09-14 补):portal 挂 body 且 z-auto,营销首页 hero 区
            // 祖先 z-10 会整体压住弹层(与 add-menu-popover 同根因)
            // p-3(2026-09-21 补):对齐全局弹层四边内边距规范(permission-mode/history
            // 同族统一 p-3),此前容器漏写 padding 导致标题/圆环/明细全部贴边
            // fixed(2026-09-25 补):定位口径显式落进类名。此前 position 只在 inline
            // style 里,portal 挂 body 的容器一旦被读 DOM 的一方(守门 check-portal-fixed、
            // 无障碍遍历、后续改样式的人)检查,类名上看不出它是浮层 —— 而"忘了写定位"
            // 正是弹层跟着页面滚走那一类事故的成因。top/left 仍由 inline 给(坐标是动态的)。
            className="fixed z-popover w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={coords ? { top: coords.top, left: coords.left } : { top: -9999, left: -9999 }}
            role="dialog"
            aria-label={t('title')}
            aria-modal="true"
            tabIndex={-1}
          >
            {/* 标题 */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('title')}</span>
              <span
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                  style.bg,
                  style.text,
                )}
              >
                {t(style.label)}
              </span>
            </div>

            {/* 大圆环 + 模型信息 */}
            <div className="flex items-center gap-4">
              <PanelRing ratio={ratio} usedTokens={usedTokens} maxTokens={maxTokens} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs">
                <StatRow label={t('currentModel')} value={model} truncate />
                <StatRow label={t('used')} value={formatTokenCount(usedTokens)} mono />
                <StatRow label={t('max')} value={formatTokenCount(maxTokens)} mono />
                <StatRow label={t('messages')} value={String(messageCount)} mono />
              </div>
            </div>

            {/* 归因分解:按构成来源回答"是谁占满的",每档可展开明细 */}
            <div className="mt-3" data-testid="context-usage-attribution">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium">{t('breakdownTitle')}</span>
                {attribution.topKey && (
                  <span className="min-w-0 truncate text-[10px] text-muted-foreground">
                    {t('topContributor', {
                      name: t(SEGMENT_META[attribution.topKey].labelKey),
                      share: formatShare(
                        attribution.segments.find((s) => s.key === attribution.topKey)?.share ?? 0,
                      ),
                    })}
                  </span>
                )}
              </div>

              {/* 构成条:只画本端可观测且确有占用的档;不可观测档另列说明,不得凭空填色 */}
              <div
                className="flex h-2 w-full overflow-hidden rounded-sm bg-muted"
                data-testid="context-usage-attribution-bar"
              >
                {attribution.segments
                  .filter((seg) => seg.observed && seg.tokens > 0)
                  .map((seg) => (
                    <div
                      key={seg.key}
                      className={cn('h-full', SEGMENT_META[seg.key].colorClass)}
                      style={{ width: `${Math.min(seg.share * 100, 100)}%` }}
                      data-testid={`context-usage-attribution-${seg.key}`}
                    />
                  ))}
              </div>

              <div className="mt-1.5 flex flex-col gap-0.5">
                {attribution.segments.map((seg) => {
                  const meta = SEGMENT_META[seg.key]
                  const open = expandedKeys[seg.key] === true
                  const expandable = seg.observed && seg.details.length > 0
                  // foldDetails 已按 tokens 降序 ⇒ [0] 就是本档最大的一项
                  const topDetail = expandable ? seg.details[0] : undefined
                  return (
                    <div key={seg.key} data-testid={`context-usage-attribution-row-${seg.key}`}>
                      <button
                        type="button"
                        onClick={() => expandable && toggleSegment(seg.key)}
                        disabled={!expandable}
                        aria-expanded={expandable ? open : undefined}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[11px] transition-colors',
                          expandable ? 'hover:bg-accent' : 'cursor-default',
                          !seg.observed && 'text-muted-foreground',
                        )}
                      >
                        {expandable ? (
                          open ? (
                            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )
                        ) : (
                          // 不可展开时留同宽占位,避免箭头出现/消失把标签左右推
                          <span className="h-3 w-3 shrink-0" aria-hidden="true" />
                        )}
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-sm',
                            seg.observed ? meta.colorClass : 'bg-muted-foreground/40',
                          )}
                        />
                        <span className="min-w-0 truncate">{t(meta.labelKey)}</span>
                        {/* 收起态就把"本档最大的一项"摊在档名之后:这一档到底是谁
                            占掉的,不该要先点开才知道(失败结果的原因尤其如此)。
                            展开后这行让位给完整明细,不重复占位。 */}
                        {!open && topDetail ? (
                          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/80">
                            {translateDetail(topDetail)}
                          </span>
                        ) : null}
                        <span className="ml-auto shrink-0 tabular-nums text-foreground">
                          {seg.observed ? formatTokenCount(seg.tokens) : '—'}
                        </span>
                        <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
                          {seg.observed ? formatShare(seg.share) : '—'}
                        </span>
                      </button>

                      {!seg.observed && (
                        <p className="py-0.5 pl-6 text-[10px] leading-relaxed text-muted-foreground">
                          {seg.unobservedCode === 'server-only'
                            ? t('unobservedServerOnly')
                            : t('unobservedNotSupplied')}
                        </p>
                      )}

                      {expandable && open && (
                        <div
                          className="mt-0.5 mb-1 rounded-sm bg-muted/40 px-2 py-1.5"
                          data-testid={`context-usage-attribution-details-${seg.key}`}
                        >
                          <div className="flex flex-col gap-0.5">
                            {seg.details.map((detail, idx) => (
                              <div
                                key={`${detail.label}-${idx}`}
                                className="flex items-baseline gap-2 text-[10px]"
                              >
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                  {translateDetail(detail)}
                                </span>
                                <span className="shrink-0 tabular-nums text-foreground">
                                  {formatTokenCount(detail.tokens)}
                                </span>
                              </div>
                            ))}
                          </div>
                          {seg.truncated > 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {t('detailsTruncated', { count: String(seg.truncated) })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 未归类开销:provider 真值高于归因和时如实交代差额来源,不假装对得上 */}
              {attribution.residualTokens > 0 && (
                <p
                  className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground"
                  data-testid="context-usage-residual"
                >
                  {t('residualNote', {
                    tokens: formatTokenCount(attribution.residualTokens),
                  })}
                </p>
              )}

              {/* 缓存命中:占用不变、重算量变 —— 两个数分开报,不得混为一谈 */}
              <div
                className="mt-2 rounded-sm bg-muted/40 px-2 py-1.5 text-[10px] leading-relaxed"
                data-testid="context-usage-cache"
              >
                {attribution.cache.observed ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {t('cacheHit', {
                          ratio: formatShare(attribution.cache.hitRatio),
                          read: formatTokenCount(attribution.cache.cacheReadTokens),
                        })}
                      </span>
                      <span className="shrink-0 tabular-nums text-foreground">
                        {formatTokenCount(attribution.cache.recomputeTokens)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {t('cacheOccupancyNote', {
                        occupied: formatTokenCount(attribution.cache.occupiedTokens),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground" data-testid="context-usage-cache-unavailable">
                    {t('cacheUnavailable')}
                  </p>
                )}
              </div>
            </div>

            {/* 压缩区 */}
            <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t('compressTitle')}</span>
              </div>
              {!conversationId ? (
                <p className="text-[11px] text-muted-foreground">{t('noConversation')}</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCompress(200000)}
                    disabled={compressDisabled}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      // 2026-07-19 中文 + 图标垂直对齐
                      '[&>span]:translate-y-[var(--text-vcenter-offset)]',
                    )}
                  >
                    {compressing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Minimize2 className="h-3 w-3" />
                    )}
                    <span>{t('compressTo200k')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCompress(1000000)}
                    disabled={compressDisabled}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      '[&>span]:translate-y-[var(--text-vcenter-offset)]',
                    )}
                  >
                    {compressing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Minimize2 className="h-3 w-3" />
                    )}
                    <span>{t('compressTo1m')}</span>
                  </button>
                </div>
              )}

              {/* 压缩结果 */}
              {compressResult && (
                <div className="mt-2 flex items-start gap-1.5 rounded-sm bg-emerald-500/10 p-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{t('compressSuccess')}</div>
                    <div className="tabular-nums text-muted-foreground">
                      {compressResult.originalChars.toLocaleString()} →{' '}
                      {compressResult.compressedChars.toLocaleString()} · {t('ratio')}{' '}
                      {/* 不吞负值:压缩后反而更大时如实显示负压缩率,暴露异常数据 */}
                      {(
                        1 -
                        compressResult.compressedChars / Math.max(compressResult.originalChars, 1)
                      ).toLocaleString(undefined, {
                        style: 'percent',
                        maximumFractionDigits: 1,
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 压缩错误 */}
              {compressError && (
                <div className="mt-2 flex items-start gap-1.5 rounded-sm bg-red-500/10 p-1.5 text-[11px] text-red-700 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <div className="min-w-0 break-words">{compressError}</div>
                </div>
              )}
            </div>

            {/* 说明 */}
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              {t('disclaimer')}
            </p>
          </div>,
          document.body,
        )}
    </div>
  )
}

// ============================================================================
// 辅助组件
// ============================================================================

function StatRow({
  label,
  value,
  mono,
  truncate,
}: {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn('text-foreground', mono && 'tabular-nums', truncate && 'min-w-0 truncate')}
      >
        {value}
      </span>
    </div>
  )
}

export default ContextUsageRing
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
