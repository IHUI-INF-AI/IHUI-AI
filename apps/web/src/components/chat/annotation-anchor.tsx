// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D91 四类文档批注锚点 —— 预览器侧采集/派发族(G-124,2026-09-24 立)。
//
// 职责边界:预览器内的**选区采集 → 注事件派发 → D22 消费兼容**。
//  - XLSX:XlsxGrid 单元格选区 → {sheet, range} 锚(office-preview.tsx 接线)
//  - DOCX:docx-preview 渲染 DOM 文本选区 → 段落序号锚(office-preview.tsx 接线)
//  - PDF / PPTX:当前预览形态无选区/元素坐标采集能力(PDF=iframe、PPTX=大纲
//    降级),属 D41 二期,登记不做 —— 本组件的类型分叉仍穷尽四类,扩 kind 不改本件。
//
// 派发复用 D22 事件族 `ihui:add-text-reference`(message-input 消费者只读
// detail.text,结构化字段为纯增量,不破坏既有文本引用流)。状态判定一律走
// `@ihui/shared/chat/annotation-anchors` 的**单一状态机**(applyAnchorAction,
// 四类共用),本族不做第二套状态判定;坐标文案类型驱动(穷尽 switch 零 default),
// 键取自词包 `ai.pane.annotationAnchors`(DOCX 段锚文案为 D91 扩展键 label.docxText)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  applyAnchorAction,
  canRelabel,
  isTerminalAnchorState,
  toTaskInput,
  type AnnotationAnchor,
  type AnnotationAnchorState,
} from '@ihui/shared/chat/annotation-anchors'

/** D22 文本引用事件名(message-input.tsx 消费者监听的同一通道)。 */
export const ADD_TEXT_REFERENCE_EVENT = 'ihui:add-text-reference'

/** 注事件采集来源(XLSX 单元格选区 / DOCX 文本选区;PDF/PPTX 二期登记)。 */
export type AnchorReferenceSource = 'xlsx-selection' | 'docx-selection'

/**
 * `ihui:add-text-reference` 的 D91 扩展 detail。
 * 兼容约束:`text` 是既有消费者(message-input.tsx)唯一读取的字段,语义不变;
 * 其余均为纯增量结构化字段,既有消费流零感知。
 */
export interface AnchorReferenceDetail {
  /** 文本引用全文(`[坐标文案] 描述`),兼容 D22 消费者 */
  readonly text: string
  /** 结构化锚点(kind + 各类坐标字段) */
  readonly anchor: AnnotationAnchor
  /** 采集来源 */
  readonly source: AnchorReferenceSource
  /** XLSX 工作表名(扁平扩展字段) */
  readonly sheet?: string
  /** XLSX 选区(扁平扩展字段) */
  readonly range?: string
  /** DOCX 段落锚(1 起) */
  readonly paragraph?: number
  /** DOCX 选中文本摘要 */
  readonly excerpt?: string
}

/** 单一派发点:window 级 CustomEvent,与 D22 消费者同通道同机制。 */
export function emitAnchorReference(detail: AnchorReferenceDetail): void {
  window.dispatchEvent(new CustomEvent<AnchorReferenceDetail>(ADD_TEXT_REFERENCE_EVENT, { detail }))
}

export interface AnchorCoordinateText {
  /** 坐标主文案(如 `{sheet} · {range}` / `文档第 {paragraph} 段`) */
  readonly main: string
  /** 次文案(XLSX 有 range ⇒ `已选择 {range}`;其余类无) */
  readonly secondary: string | null
}

type AnchorT = (key: string, values?: Record<string, string | number>) => string

/**
 * 锚点 → 坐标文案的**唯一**类型驱动派发点(穷尽 switch 零 default)。
 * 与 shared `anchorLabel` 的键族逐字对齐;DOCX 段锚用 D91 扩展键 `label.docxText`
 * (shared 的 docx 分型是页码坐标,预览器拿不到页码,按任务规格锚段落序号)。
 */
export function anchorCoordinateText(
  anchor: AnnotationAnchor,
  docxParagraph: number | undefined,
  t: AnchorT,
): AnchorCoordinateText {
  switch (anchor.kind) {
    case 'pdf':
      return { main: t('label.pdf', { page: anchor.page ?? '' }), secondary: null }
    case 'pptx':
      return anchor.element
        ? {
            main: t('label.pptx', { slide: anchor.slide ?? '', element: anchor.element }),
            secondary: t('label.pptxComment', { element: anchor.element }),
          }
        : { main: t('label.pptxSlide', { slide: anchor.slide ?? '' }), secondary: null }
    case 'docx':
      return docxParagraph != null
        ? { main: t('label.docxText', { paragraph: docxParagraph }), secondary: null }
        : { main: t('label.docx', { page: anchor.page ?? '' }), secondary: null }
    case 'xlsx':
      return anchor.range
        ? {
            main: t('label.xlsx', { sheet: anchor.sheet ?? '', range: anchor.range }),
            secondary: t('label.xlsxSelected', { range: anchor.range }),
          }
        : { main: t('label.xlsxSheet', { sheet: anchor.sheet ?? '' }), secondary: null }
  }
}

export interface AnnotationAnchorCaptureProps {
  /** 已采集的坐标锚(xlsx 带 sheet+range;docx 携 docxParagraph) */
  readonly anchor: AnnotationAnchor
  /** DOCX 段落锚(1 起);仅 kind='docx' 时生效 */
  readonly docxParagraph?: number
  /** 备注预填(DOCX 场景 = 选中文本摘要) */
  readonly initialNote?: string
  /** 派发来源 */
  readonly source: AnchorReferenceSource
  /** 取消/删除后由调用方清锚(组件内状态仍走 shared 单一状态机) */
  readonly onDispose?: (anchor: AnnotationAnchor) => void
  className?: string
  'data-testid'?: string
}

/**
 * 预览器内锚点采集卡:坐标文案 + 「描述希望 Agent 修改或检查的内容」
 * → 添加到任务(经 emitAnchorReference 派发),支持 取消/删除。
 * 状态机 = shared applyAnchorAction(四类共用,对 kind 无感)。
 */
export function AnnotationAnchorCapture({
  anchor,
  docxParagraph,
  initialNote,
  source,
  onDispose,
  className,
  'data-testid': testId,
}: AnnotationAnchorCaptureProps) {
  const t = useTranslations('ai.pane.annotationAnchors')
  const [state, setState] = React.useState<AnnotationAnchorState>('labeled')
  const [note, setNote] = React.useState(initialNote ?? '')

  const coords = anchorCoordinateText(anchor, docxParagraph, t)
  const terminal = isTerminalAnchorState(state)

  const handleAdd = (): void => {
    const taskInput = toTaskInput(anchor, note, coords.main)
    if (!taskInput) return
    emitAnchorReference({
      text: taskInput,
      anchor,
      source,
      sheet: anchor.sheet,
      range: anchor.range,
      paragraph: docxParagraph,
      excerpt: initialNote,
    })
    setState((prev) => applyAnchorAction(prev, 'add'))
  }

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={cn('flex flex-col gap-1 rounded-md bg-muted/30 p-2', className)}
      data-testid={testId}
      data-anchor-kind={anchor.kind}
      data-anchor-state={state}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'text-[11px] font-medium',
            terminal ? 'text-muted-foreground/60 line-through' : 'text-primary',
          )}
          data-anchor-label="main"
        >
          {coords.main}
        </span>
        {coords.secondary ? (
          <span className="text-[11px] text-muted-foreground" data-anchor-label="secondary">
            {coords.secondary}
          </span>
        ) : null}
      </div>

      {!terminal ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('taskInputPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-sm border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            data-testid="annotation-anchor-note"
          />
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={handleAdd}
              disabled={note.trim().length === 0 || state === 'added'}
              className="inline-flex items-center rounded-sm bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              data-action="add"
            >
              {t('addToTask')}
            </button>
            <button
              type="button"
              onClick={() => {
                onDispose?.(anchor)
                setState((prev) => applyAnchorAction(prev, 'cancel'))
              }}
              className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
              data-action="cancel"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                onDispose?.(anchor)
                setState((prev) => applyAnchorAction(prev, 'delete'))
              }}
              className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              data-action="delete"
            >
              {t('delete')}
            </button>
            {canRelabel(state) && state === 'cancelled' ? (
              <button
                type="button"
                onClick={() => setState((prev) => applyAnchorAction(prev, 'relabel'))}
                className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
                data-action="relabel"
              >
                {t('relabel')}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
