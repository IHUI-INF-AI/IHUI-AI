// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import {
  Loader2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Scissors,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@/components/common'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { createPortal } from 'react-dom'
import { useChatStore } from '@/stores/chat'
import { compressConversation, compactConversation, getMessages } from '@ihui/api-client'
import { getModelContextCapacity, formatTokenCount } from '@/lib/model-context-capacity'
import { estimateChatMessagesTokens } from '@/lib/token-estimate'

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
// 小圆环 trigger
// ============================================================================

interface TriggerRingProps {
  ratio: number
  usedTokens: number
  maxTokens: number
}

function TriggerRing({ ratio, usedTokens, maxTokens }: TriggerRingProps) {
  const level = getUsageLevel(ratio)
  const style = USAGE_STYLES[level]
  // ratio > 1 时 clamp 到 1,但中心数字仍显示真实百分比(警示超限)
  const progressRatio = Math.min(ratio, 1)
  const offset = TRIGGER_CIRC * (1 - progressRatio)
  const percent = Math.round(ratio * 100)

  return (
    <span
      className={cn(
        'relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'hover:bg-accent',
      )}
      aria-hidden="true"
    >
      <svg
        width={TRIGGER_SIZE}
        height={TRIGGER_SIZE}
        viewBox={`0 0 ${TRIGGER_SIZE} ${TRIGGER_SIZE}`}
        className={style.text}
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
      {/* a11y:整个 trigger 由外层 button 提供 label,这里隐藏 */}
      <span className="sr-only">
        {usedTokens} / {maxTokens}
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
  // 压缩会话历史(/compact)文案复用 chat.compaction 区块 —— 与原工具栏剪刀按钮
  // (2026-09-04 迁入本弹窗)共用同一组 key,五语种齐全,不新增 i18n 负担
  const tc = useTranslations('chat.compaction')
  const messages = useChatStore((s) => s.messages)
  const conversationId = useChatStore((s) => s.conversationId)

  const maxTokens = React.useMemo(() => getModelContextCapacity(model), [model])
  const usedTokens = React.useMemo(() => estimateChatMessagesTokens(messages), [messages])
  const ratio = maxTokens > 0 ? usedTokens / maxTokens : 0
  const messageCount = messages.filter(
    (m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content,
  ).length

  const [compressing, setCompressing] = React.useState(false)
  const [compressResult, setCompressResult] = React.useState<{
    originalChars: number
    compressedChars: number
  } | null>(null)
  const [compressError, setCompressError] = React.useState<string | null>(null)

  // ── 压缩会话历史(2026-09-04 从工具栏剪刀按钮完整迁入) ──────────────────────
  // 语义:立即压缩当前会话历史(对标 CLI /compact),与 /chat/stream 自动压缩同一套
  // 管线:LLM 语义摘要 → 归档落库 → replaceMessages 持久化,成功后刷新消息列表。
  // 行为契约(与 e2e chat-manual-compact.spec.ts 对齐,data-testid 保持不变):
  // - 请求进行中 loading + 禁用;compressed=true → 成功 toast + 重新拉取当前会话消息
  //   (仅仍在原会话时写回 store,防竞态)
  // - reason=too_few_messages / incompressible → info toast
  // - 404/其他错误 → 统一错误 toast(Toaster 自动中文化)
  const [compacting, setCompacting] = React.useState(false)
  const handleCompact = React.useCallback(async () => {
    const id = useChatStore.getState().conversationId
    if (!id || compacting || isStreaming) return
    setCompacting(true)
    try {
      const res = await compactConversation(id)
      if (res.success && res.data) {
        if (res.data.compressed) {
          toast.success(
            tc('compactSuccess', {
              before: res.data.originalTokens,
              after: res.data.compressedTokens,
              saved: Math.max(0, res.data.originalTokens - res.data.compressedTokens),
            }),
          )
          const result = await getMessages(id, { pageSize: 100 })
          if (result.success && result.data && useChatStore.getState().conversationId === id) {
            useChatStore.getState().setMessages(
              result.data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.createdAt).getTime(),
                model: '',
                reasoning: m.reasoning,
              })),
            )
          }
        } else if (res.data.reason === 'too_few_messages') {
          toast.info(tc('compactTooFew'))
        } else {
          toast.info(tc('compactIncompressible'))
        }
      } else {
        toast.error(tc('compactFailed'), {
          description: res.success ? undefined : res.error,
        })
      }
    } catch (e) {
      const msg = (e as Error).message || tc('compactFailed')
      toast.error(tc('compactFailed'), { description: msg })
    } finally {
      setCompacting(false)
    }
  }, [compacting, isStreaming, tc])

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
  // 压缩会话历史(/compact)禁用态:与原剪刀按钮 disabled 逻辑逐字一致
  const compactDisabled = !conversationId || compacting || isStreaming

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  return (
    <div>
      <Tooltip content={triggerLabel} side="top">
        <button
          ref={triggerRef}
          onClick={() => setIsOpen((prev) => !prev)}
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          // e2e 锚点:压缩入口已从工具栏剪刀按钮迁入本弹窗(2026-09-04),
          // 测试先点开本 trigger 再操作弹窗内 compact-context-button
          data-testid="context-usage-trigger"
          // 2026-09-02 治理:自写 popover trigger 加 data-state,让 globals.css:1090
          // `button[data-state='closed']:focus-visible { box-shadow: none }` 抑制关闭后
          // 焦点环常驻(此文件未显式 triggerRef.focus 归还,但 click-outside 关闭后 trigger
          // 仍可能短暂持有焦点,加 data-state 是零成本防御)。
          data-state={isOpen ? 'open' : 'closed'}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <TriggerRing ratio={ratio} usedTokens={usedTokens} maxTokens={maxTokens} />
        </button>
      </Tooltip>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="w-72 rounded-md border bg-popover text-popover-foreground shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {/* ── 压缩区(2026-09-04 整合:工具栏剪刀按钮功能完整迁入) ──────────
                ① 压缩会话历史(/compact):立即压缩当前会话,替换消息列表,不可逆 ──
                ② 生成压缩存档(/compress):LLM 生成压缩文本存 compressedContext 字段,
                   不改动会话消息,作为后续对话的上下文摘要 */}
            <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2.5">
              {/* ① 压缩会话历史(立即生效):
                  按钮恒渲染、无会话时仅禁用 —— 与原剪刀按钮行为一致,
                  e2e chat-manual-compact.spec.ts 依赖 disabled 态 + aria-label 契约 */}
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Scissors className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{tc('compactButton')}</span>
              </div>
              <button
                type="button"
                onClick={handleCompact}
                data-testid="compact-context-button"
                disabled={compactDisabled}
                aria-label={compacting ? tc('compacting') : tc('compactButton')}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  // 2026-07-19 中文 + 图标垂直对齐
                  '[&>span]:translate-y-[var(--text-vcenter-offset)]',
                )}
              >
                {compacting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Scissors className="h-3 w-3" />
                )}
                <span>{compacting ? tc('compacting') : tc('compactButton')}</span>
              </button>
              {!conversationId && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t('noConversation')}</p>
              )}

              {/* 分隔线:① 立即压缩 vs ② 压缩存档,两种机制视觉隔离 */}
              <div className="my-2.5 flex items-center gap-2" role="separator">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] text-muted-foreground">↓</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* ② 生成压缩存档(不改动会话消息):无会话时整个隐藏,
                  由 ① 的 noConversation 提示统一承担,避免同屏重复提示 */}
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t('compressTitle')}</span>
              </div>
              {conversationId && (
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
