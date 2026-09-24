// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D91 四类文档批注锚点标签(G-124,2026-09-24 立) —— 纯展示渲染件。
//
// **职责边界**:只做四坐标标签渲染(PDF 页 / PPTX 张+元素 / DOCX 页 / XLSX 表+选区)
// + 统一动作行(「描述希望 Agent 修改或检查的内容」→ 添加到任务,支持 取消/删除)。
// 不重复 D87 `ReplyAnnotationLayer` 的选区圈选交互;接入 artifact-canvas 时由调用方
// 经 `ihui:add-text-reference` 同机制派发(D22),本组件只经回调交出回流文本。
//
// 状态判定一律走 `@ihui/shared/chat/annotation-anchors` 的**单一状态机**
// (`applyAnchorAction`,四类共用,对 kind 无感),端内不另建第二套锚点状态判定。
// 文案键与插值完全由判定层 `anchorLabel` 派发,组件侧只做 id → t() 的穷尽映射
// (规避动态 t() 键的类型失配,同 D72 worktree-card 的 hint 三元处理)。

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  anchorLabel,
  applyAnchorAction,
  canRelabel,
  isTerminalAnchorState,
  toTaskInput,
  type AnnotationAnchor,
  type AnnotationAnchorAction,
  type AnnotationAnchorLabelId,
  type AnnotationAnchorState,
} from '@ihui/shared/chat/annotation-anchors'

export interface AnnotationAnchorLabelProps {
  /** 锚点坐标(kind + 各类坐标字段) */
  anchor: AnnotationAnchor
  /** 初始态(缺省 labeled:组件拿到 anchor 即已有坐标);状态机是四类共用的那一套 */
  initialState?: AnnotationAnchorState
  /** 添加到任务回调(参数为回流文本 toTaskInput 的结果) */
  onAddToTask?: (taskInput: string, anchor: AnnotationAnchor) => void
  /** 取消回调 */
  onCancel?: (anchor: AnnotationAnchor) => void
  /** 删除回调 */
  onDelete?: (anchor: AnnotationAnchor) => void
  className?: string
  'data-testid'?: string
}

export function AnnotationAnchorLabel({
  anchor,
  initialState,
  onAddToTask,
  onCancel,
  onDelete,
  className,
  'data-testid': testId,
}: AnnotationAnchorLabelProps) {
  const t = useTranslations('ai.pane.annotationAnchors')
  const [state, setState] = React.useState<AnnotationAnchorState>(initialState ?? 'labeled')
  const [note, setNote] = React.useState('')

  const label = anchorLabel(anchor)

  // id → 文案的穷尽映射(判定层 anchorLabel 派发 id,组件不做 kind 判定);
  // 坐标字段可选,next-intl 插值不接受 undefined,缺省以空串兜底(不渲染 "undefined")
  const labelText: Record<AnnotationAnchorLabelId, string> = {
    pdf: t('label.pdf', { page: anchor.page ?? '' }),
    docx: t('label.docx', { page: anchor.page ?? '' }),
    pptx: t('label.pptx', { slide: anchor.slide ?? '', element: anchor.element ?? '' }),
    pptxSlide: t('label.pptxSlide', { slide: anchor.slide ?? '' }),
    pptxComment: t('label.pptxComment', { element: anchor.element ?? '' }),
    xlsx: t('label.xlsx', { sheet: anchor.sheet ?? '', range: anchor.range ?? '' }),
    xlsxSheet: t('label.xlsxSheet', { sheet: anchor.sheet ?? '' }),
    xlsxSelected: t('label.xlsxSelected', { range: anchor.range ?? '' }),
  }

  const run = (action: AnnotationAnchorAction): void => {
    setState((prev) => applyAnchorAction(prev, action))
  }

  const handleAdd = (): void => {
    const taskInput = toTaskInput(anchor, note, labelText[label.id])
    if (!taskInput) return
    onAddToTask?.(taskInput, anchor)
    run('add')
  }

  const terminal = isTerminalAnchorState(state)
  const relabelable = canRelabel(state)

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
          data-anchor-label={label.key}
        >
          {labelText[label.id]}
        </span>
        {label.secondary ? (
          <span
            className="text-[11px] text-muted-foreground"
            data-anchor-secondary={label.secondary.key}
          >
            {labelText[label.secondary.id]}
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
              className="inline-flex items-center rounded-sm bg-cta px-2 py-0.5 text-[10px] font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-50"
              data-action="add"
            >
              {t('addToTask')}
            </button>
            <button
              type="button"
              onClick={() => {
                onCancel?.(anchor)
                run('cancel')
              }}
              className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
              data-action="cancel"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete?.(anchor)
                run('delete')
              }}
              className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              data-action="delete"
            >
              {t('delete')}
            </button>
            {relabelable && (state === 'cancelled' || state === 'idle') ? (
              <button
                type="button"
                onClick={() => run('relabel')}
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
