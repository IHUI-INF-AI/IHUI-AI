// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D42 浏览器视觉标注 —— 样式面板(G-50,2026-09-24 立)。
//
// 职责边界:CDP 点选回传的元素 → 样式字段编辑(颜色/边框/圆角/字号/内外边距,
// 拿不到的 computedStyle 字段禁用态)→ 批注文本 → 「添加到对话」。
// 派发复用 D22/D91 事件族 `ihui:add-text-reference`(message-input 消费者只读
// detail.text,结构化字段纯增量,不新增传输通道)。
// annotationStale(④):批注创建时记录元素签名(选择器+文本指纹),面板打开与
// 发送前各重查一次;DOM 已变显示弱警示条(amber,不阻塞发送)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { ADD_TEXT_REFERENCE_EVENT } from '@/components/chat/annotation-anchor'

/** 可编辑样式字段族(与注入端 computedStyle 采集逐字对齐,i18n 键同名) */
export const VISUAL_STYLE_FIELDS = [
  'color',
  'backgroundColor',
  'border',
  'borderRadius',
  'fontSize',
  'margin',
  'padding',
] as const

export type VisualStyleField = (typeof VISUAL_STYLE_FIELDS)[number]
export type VisualStyleSnapshot = Partial<Record<VisualStyleField, string>>

/** CDP 点选注入端回传的被点选元素(签名 = 选择器 + 文本指纹) */
export interface PickedVisualElement {
  selector: string
  textExcerpt: string
  signature: string
  styles: VisualStyleSnapshot
}

/** `ihui:add-text-reference` 的 D42 扩展 detail(text 兼容既有消费者) */
export interface VisualAnnotationReferenceDetail {
  text: string
  source: 'browser-visual-annotation'
  selector: string
  styles: VisualStyleSnapshot
  note: string
}

export interface AnnotationStylePanelProps {
  /** 当前点选的元素(null 面板不渲染) */
  element: PickedVisualElement | null
  /** stale 重查(面板打开 + 发送前各一次);返回 true 表示元素已变化 */
  recheckStale?: (element: PickedVisualElement) => boolean | Promise<boolean>
  /** 关闭面板 */
  onDismiss?: () => void
  className?: string
}

/**
 * 样式标注浮层:字段编辑 + 批注框 + 添加到对话 + stale 弱警示条。
 * 浮层规范:p-3 内边距、rounded-md 设计令牌(§4)。
 */
export function AnnotationStylePanel({
  element,
  recheckStale,
  onDismiss,
  className,
}: AnnotationStylePanelProps) {
  const t = useTranslations('visualAnnotation')
  const [styles, setStyles] = React.useState<VisualStyleSnapshot>({})
  const [note, setNote] = React.useState('')
  const [stale, setStale] = React.useState(false)

  // ④ 面板(重新)打开/换元素:重置编辑态并重查元素签名
  React.useEffect(() => {
    if (!element) return
    setStyles(element.styles)
    setNote('')
    setStale(false)
    let alive = true
    void Promise.resolve(recheckStale?.(element)).then((s) => {
      if (alive) setStale(s === true)
    })
    return () => {
      alive = false
    }
  }, [element, recheckStale])

  if (!element) return null

  /** 组装结构化文本(选择器摘要 + 样式快照 + 批注)并派发同族事件 */
  const handleAdd = (): void => {
    const trimmed = note.trim()
    if (!trimmed) return
    const snapshot = VISUAL_STYLE_FIELDS.filter(
      (f) => typeof styles[f] === 'string' && styles[f] !== '',
    )
      .map((f) => `${t(f)}: ${styles[f]}`)
      .join('; ')
    const text = [
      `${t('contextTitle')} [${element.selector}]`,
      `${t('elementText')}: ${element.textExcerpt || '-'}`,
      `${t('styleSnapshot')}: ${snapshot || '-'}`,
      `${t('annotationLabel')}: ${trimmed}`,
    ].join('\n')
    const detail: VisualAnnotationReferenceDetail = {
      text,
      source: 'browser-visual-annotation',
      selector: element.selector,
      styles: { ...styles },
      note: trimmed,
    }
    // ④ 发送前再查一次签名(弱警示,不阻塞派发)
    void Promise.resolve(recheckStale?.(element)).then((s) => setStale(s === true))
    window.dispatchEvent(
      new CustomEvent<VisualAnnotationReferenceDetail>(ADD_TEXT_REFERENCE_EVENT, { detail }),
    )
    setNote('')
  }

  return (
    <div
      role="group"
      aria-label={t('panelTitle')}
      className={cn(
        'thin-scroll flex flex-col gap-2 overflow-auto rounded-md border border-border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-(--duration-unified) ease-unified',
        className,
      )}
      data-testid="annotation-style-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold">{t('panelTitle')}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
          aria-label={t('close')}
          data-action="dismiss"
        >
          {t('close')}
        </button>
      </div>

      {stale && (
        <div
          className="rounded-sm bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
          data-testid="stale-warning"
          role="status"
        >
          {t('staleWarning')}
        </div>
      )}

      <div className="truncate font-mono text-[10px] text-muted-foreground">
        {element.selector}
      </div>
      {element.textExcerpt ? (
        <div className="truncate text-[11px] text-foreground" data-testid="picked-element-text">
          {element.textExcerpt}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5">
        {VISUAL_STYLE_FIELDS.map((field) => {
          const value = styles[field] ?? ''
          return (
            <label key={field} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{t(field)}</span>
              <input
                value={value}
                onChange={(e) => setStyles((prev) => ({ ...prev, [field]: e.target.value }))}
                disabled={typeof styles[field] !== 'string'}
                data-testid={`style-${field}`}
                className="h-6 rounded border border-input bg-background px-1.5 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
              />
            </label>
          )
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('annotationPlaceholder')}
        rows={2}
        className="w-full resize-none rounded-sm border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        data-testid="annotation-note"
      />

      <button
        type="button"
        onClick={handleAdd}
        disabled={note.trim().length === 0}
        className="self-start rounded-sm bg-cta px-2 py-0.5 text-[10px] font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="add-to-conversation"
      >
        {t('addToConversation')}
      </button>
    </div>
  )
}
