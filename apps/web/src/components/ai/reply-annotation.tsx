// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  type Annotation,
  type AnnotationState,
  addAnnotation,
  getAnnotations,
  locateAnnotation,
  readContainerText,
  removeAnnotation,
  selectionToAnchor,
  updateAnnotationComment,
} from '@/lib/annotations'

interface ReplyAnnotationLayerProps {
  /** 所属 AI 回复消息 id */
  messageId: string
  /** 会话 id(用于按会话持久化批注;为空则不启用批注) */
  conversationId: string | null
  /** 被批注的 AI 回复渲染内容(通常为 MarkdownStream) */
  children: React.ReactNode
}

/** 把容器拼接文本中的 [from,to) 区间选中(浏览器原生高亮,安全不污染 React DOM)。 */
function selectRange(container: HTMLElement, from: number, to: number): void {
  const { spans } = readContainerText(container)
  const startSpan =
    spans.find((s) => from >= s.start && from <= s.end) ??
    spans.find((s) => from <= s.end)
  const endSpan =
    spans.find((s) => to >= s.start && to <= s.end) ?? spans.find((s) => to >= s.start)
  if (!startSpan || !endSpan) return
  const startNode = startSpan.node
  const startOffset = Math.min(
    Math.max(from - startSpan.start, 0),
    startNode.nodeValue?.length ?? 0,
  )
  const endNode = endSpan.node
  const endOffset = Math.min(Math.max(to - endSpan.start, 0), endNode.nodeValue?.length ?? 0)
  const range = document.createRange()
  range.setStart(startNode, startOffset)
  range.setEnd(endNode, endOffset)
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

/** 边栏标记文案:单行 `注释 {n}:{选区段落}`,多行 `注释 {n}:{首行}…, {lineCount} 行`。 */
function annotationLabel(ann: Annotation, index: number, t: (key: string, p?: { n: number }) => string): string {
  const badge = t('badge')
  const firstLine = (ann.anchorText.split('\n')[0] ?? '').trim()
  if (ann.lineCount > 1) {
    const lineUnit = t('lineUnit')
    const head = firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine
    return `${badge} ${index}: ${head}…, ${ann.lineCount} ${lineUnit}`
  }
  const snippet = firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine
  return `${badge} ${index}: ${snippet}`
}

/**
 * ReplyAnnotationLayer — AI 回复文本批注双向锚点(D87,2026-09-23 立)。
 *
 * 复用 D22 diff-comment-panel 的交互风格(圈选 → 入口 → 输入 → 列表 → 编辑/删除),
 * 但职责独立(锚在回复选区文本,不在 diff 行),不在 diff-comment-panel 上堆叠第二职责。
 *
 * 关键能力:
 *  - 选区批注:圈选回复文本 → 浮现「添加注释」入口 → 记录 { id,messageId,anchorText,指纹,comment }。
 *  - 持久锚点:批注存 localStorage `chat:annotations:{conversationId}`,渲染时按 anchorText 定位,
 *    命中 → valid;跨刷新重渲染仍命中。
 *  - 失效态:文本被编辑/重新生成导致 anchorText 消失 → invalid,展示 `目前无法编辑此批注`,不删数据。
 *  - 再编辑/删除:列表项可展开编辑正文 / 删除;删除遇存储异常 → `无法删除注释` 反馈(非静默)。
 *  - 点击标记 → 浏览器原生选中锚点文本(命中处高亮)。
 */
export function ReplyAnnotationLayer({
  messageId,
  conversationId,
  children,
}: ReplyAnnotationLayerProps) {
  const t = useTranslations('ai.pane.annotation')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [annotations, setAnnotations] = React.useState<Annotation[]>([])
  const [states, setStates] = React.useState<Record<string, AnnotationState>>({})
  const [popover, setPopover] = React.useState<{ x: number; y: number; anchor: ReturnType<typeof selectionToAnchor> } | null>(null)
  const [draft, setDraft] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState('')
  const [deleteError, setDeleteError] = React.useState(false)

  const reload = React.useCallback((): void => {
    if (!conversationId) {
      setAnnotations([])
      return
    }
    setAnnotations(getAnnotations(conversationId, messageId))
  }, [conversationId, messageId])

  // 加载 + 计算每条批注的锚定状态(valid/invalid)
  React.useLayoutEffect(() => {
    reload()
    if (!conversationId || !containerRef.current) {
      setStates({})
      return
    }
    const { text } = readContainerText(containerRef.current)
    const next: Record<string, AnnotationState> = {}
    for (const ann of getAnnotations(conversationId, messageId)) {
      next[ann.id] = locateAnnotation(text, ann).state
    }
    setStates(next)
  }, [conversationId, messageId, children, reload])

  if (!conversationId) {
    // 无会话上下文(如预览态)不启用批注,原样透传
    return <>{children}</>
  }

  const handleMouseUp = (): void => {
    const container = containerRef.current
    if (!container) return
    const sel = window.getSelection()
    const anchor = selectionToAnchor(container, sel as Selection, messageId)
    if (!anchor) return
    const rect = sel ? sel.getRangeAt(0).getBoundingClientRect() : null
    setDraft('')
    setPopover({
      x: rect ? rect.left + rect.width / 2 : 0,
      y: rect ? rect.top : 0,
      anchor,
    })
  }

  const submitAnnotation = (): void => {
    if (!conversationId || !popover || !popover.anchor) return
    const comment = draft.trim()
    if (!comment) return
    const created = addAnnotation(conversationId, { ...popover.anchor, comment })
    setPopover(null)
    setDraft('')
    window.getSelection()?.removeAllRanges()
    if (created) reload()
  }

  const handleDelete = (id: string): void => {
    if (!conversationId) return
    const ok = removeAnnotation(conversationId, messageId, id)
    if (!ok) {
      setDeleteError(true)
      return
    }
    setDeleteError(false)
    reload()
  }

  const handleEditSave = (id: string): void => {
    if (!conversationId) return
    const comment = editDraft.trim()
    if (!comment) return
    updateAnnotationComment(conversationId, messageId, id, comment)
    setEditingId(null)
    setEditDraft('')
    reload()
  }

  const focusAnnotation = (ann: Annotation): void => {
    const container = containerRef.current
    if (!container) return
    const { text } = readContainerText(container)
    const loc = locateAnnotation(text, ann)
    if (loc.state === 'valid' && loc.start !== null && loc.end !== null) {
      selectRange(container, loc.start, loc.end)
    }
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        role="presentation"
        data-testid="reply-annotation-layer"
        onMouseUp={handleMouseUp}
      >
        {children}
      </div>

      {/* 选区「添加注释」入口 + 输入浮层 */}
      {popover && popover.anchor && (
        <div
          className="absolute z-20 rounded-md border border-border/60 bg-popover p-2 shadow-md"
          style={{ left: popover.x, top: Math.max(popover.y - 8, 8), transform: 'translate(-50%, -100%)' }}
          data-testid="annotation-popover"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('placeholder')}
            rows={2}
            className="w-56 resize-none rounded-sm border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            data-testid="annotation-input"
          />
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={submitAnnotation}
              disabled={draft.trim().length === 0}
              className="inline-flex items-center rounded-sm bg-cta px-2 py-1 text-[10px] font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="annotation-save"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setPopover(null)
                setDraft('')
              }}
              className="rounded-sm px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
              data-testid="annotation-cancel"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 删除失败反馈(非静默) */}
      {deleteError && (
        <div
          className="mt-1 rounded-sm bg-destructive/10 px-2 py-1 text-[10px] text-destructive"
          data-testid="annotation-delete-error"
        >
          {t('deleteFailed')}
        </div>
      )}

      {/* 批注边栏(注释 {n} 标记 + valid/invalid 失效态 + 编辑/删除) */}
      {annotations.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border/40 pt-2" data-testid="annotation-rail">
          <div className="text-[10px] font-medium text-muted-foreground">
            {t('countSummary', { n: annotations.length })}
          </div>
          <ul className="space-y-1">
            {annotations.map((ann, i) => {
              const state = states[ann.id] ?? 'invalid'
              const isInvalid = state === 'invalid'
              return (
                <li
                  key={ann.id}
                  className="group rounded-sm bg-muted/40 px-1.5 py-1 text-[10px]"
                  data-testid={`annotation-item-${ann.id}`}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      type="button"
                      onClick={() => focusAnnotation(ann)}
                      aria-label={annotationLabel(ann, i + 1, t)}
                      className={
                        isInvalid
                          ? 'shrink-0 rounded-sm bg-muted px-1 text-muted-foreground/60 line-through'
                          : 'shrink-0 rounded-sm bg-primary/10 px-1 text-primary'
                      }
                      data-testid={`annotation-marker-${ann.id}`}
                    >
                      {annotationLabel(ann, i + 1, t)}
                    </button>
                    <span className="min-w-0 flex-1 break-words text-foreground/80">
                      {ann.comment}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(ann.id)
                        setEditDraft(ann.comment)
                      }}
                      aria-label={t('edit')}
                      className="shrink-0 rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
                      data-testid={`annotation-edit-${ann.id}`}
                    >
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.id)}
                      aria-label={t('delete')}
                      className="shrink-0 rounded-sm p-0.5 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`annotation-delete-${ann.id}`}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  {isInvalid && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground/70" data-testid={`annotation-invalid-${ann.id}`}>
                      {t('invalid')}
                    </div>
                  )}

                  {editingId === ann.id && (
                    <div className="mt-1 space-y-1" data-testid={`annotation-edit-box-${ann.id}`}>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-sm border border-border/60 bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
                        data-testid={`annotation-edit-input-${ann.id}`}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditSave(ann.id)}
                          disabled={editDraft.trim().length === 0}
                          className="inline-flex items-center rounded-sm bg-cta px-2 py-1 text-[10px] font-medium text-cta-foreground transition-colors hover:bg-cta/90 disabled:cursor-not-allowed disabled:opacity-50"
                          data-testid={`annotation-edit-save-${ann.id}`}
                        >
                          {t('save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null)
                            setEditDraft('')
                          }}
                          className="rounded-sm px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
                          data-testid={`annotation-edit-cancel-${ann.id}`}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ReplyAnnotationLayer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
