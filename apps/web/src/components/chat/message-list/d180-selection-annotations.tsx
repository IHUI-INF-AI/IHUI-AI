// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D180(2026-09-30 立,对标竞品 chatSession.selectionAnnotations.*):会话划词批注展示层。
// - 触发:MessageItem 选区动作组第三出口「添加批注」写入 store(conversationId+messageId 归属);
// - 呈现:消息尾部批注条 = 触发钮(序号计数徽章,aria=「悬停查看批注」)+ 悬停/聚焦展开的
//   带序号批注清单(「{index}. 选中文字」+ 选段原文 + 评论或「未添加评论」+ 评论输入/添加 +
//   「移除批注 {index}」单条移除)+ 「移除全部划词批注」;
// - 与 D22 引用 chips / D184 附件出口并存,与回复级 ai.pane.annotation.* 并存不混同(键组不同)。

import * as React from 'react'
import { Eraser, MessageSquareText, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import {
  EMPTY_SELECTION_ANNOTATIONS,
  selectionAnnotationKey,
  useSelectionAnnotationsStore,
} from '@/stores/d180-selection-annotations'

interface SelectionAnnotationBarProps {
  conversationId: string
  messageId: string
}

/** 消息尾部划词批注条:无批注时整体不渲染(零占位)。 */
export function SelectionAnnotationBar({
  conversationId,
  messageId,
}: SelectionAnnotationBarProps) {
  const t = useTranslations('chat')
  const key = selectionAnnotationKey(conversationId, messageId)
  const annotations = useSelectionAnnotationsStore(
    React.useCallback(
      (s) => s.annotationsByMessage[key] ?? EMPTY_SELECTION_ANNOTATIONS,
      [key],
    ),
  )
  const removeAnnotation = useSelectionAnnotationsStore((s) => s.removeAnnotation)
  const removeAllAnnotations = useSelectionAnnotationsStore((s) => s.removeAllAnnotations)
  const setComment = useSelectionAnnotationsStore((s) => s.setComment)

  const [hoverOpen, setHoverOpen] = React.useState(false)
  const [pinned, setPinned] = React.useState(false)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})

  if (annotations.length === 0) return null

  const open = hoverOpen || pinned

  return (
    <div
      className="relative mt-0.5"
      data-testid={`selection-annotation-bar-${messageId}`}
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
      onFocusCapture={() => setHoverOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHoverOpen(false)
      }}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPinned((p) => !p)}
          aria-expanded={open}
          aria-label={t('selectionAnnotations.hoverHint')}
          data-testid={`selection-annotation-trigger-${messageId}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1',
            'text-xs text-muted-foreground shadow-sm transition-colors',
            'hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <MessageSquareText className="h-3 w-3" aria-hidden />
          {/* 数字计数徽章:确定性居中模板(AGENTS §4),不裸 span 手搓 */}
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-primary/15 px-1 text-[10px] font-semibold leading-none tabular-nums text-primary">
            {annotations.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => removeAllAnnotations(conversationId, messageId)}
          aria-label={t('selectionAnnotations.removeAll')}
          data-testid={`selection-annotation-remove-all-${messageId}`}
          className={cn(
            'inline-flex items-center rounded-sm border border-border bg-card p-1 text-muted-foreground',
            'shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <Eraser className="h-3 w-3" aria-hidden />
        </button>
      </div>
      {open && (
        <div
          className="absolute left-0 top-full z-10 mt-1 w-full max-w-md rounded-md border border-border bg-card p-3 shadow-md"
          role="group"
          aria-label={t('selectionAnnotations.hoverHint')}
          data-testid={`selection-annotation-panel-${messageId}`}
        >
          <ol className="flex flex-col gap-3">
            {annotations.map((a, i) => {
              const index = i + 1
              const draft = drafts[a.id] ?? ''
              return (
                <li key={a.id} data-testid={`selection-annotation-item-${messageId}-${index}`}>
                  <div className="text-xs font-medium text-foreground">
                    {t('selectionAnnotations.selectedText', { index })}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {a.text}
                  </p>
                  {a.comment ? (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-foreground">
                      {a.comment}
                    </p>
                  ) : (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {t('selectionAnnotations.noComment')}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [a.id]: e.target.value }))
                      }
                      placeholder={t('selectionAnnotations.commentPlaceholder')}
                      aria-label={t('selectionAnnotations.commentAriaLabel')}
                      data-testid={`selection-annotation-comment-input-${messageId}-${index}`}
                      className={cn(
                        'min-w-0 flex-1 rounded-sm border border-border bg-background px-2 py-1 text-xs',
                        'text-foreground placeholder:text-muted-foreground',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      )}
                    />
                    <button
                      type="button"
                      disabled={!draft.trim()}
                      onClick={() => {
                        setComment(conversationId, messageId, a.id, draft.trim())
                        setDrafts((d) => ({ ...d, [a.id]: '' }))
                      }}
                      data-testid={`selection-annotation-comment-add-${messageId}-${index}`}
                      className={cn(
                        'rounded-sm border border-border bg-card px-2 py-1 text-xs text-muted-foreground',
                        'shadow-sm transition-colors hover:border-primary/40 hover:text-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      )}
                    >
                      {t('selectionAnnotations.addComment')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAnnotation(conversationId, messageId, a.id)}
                      aria-label={t('selectionAnnotations.removeOne', { index })}
                      data-testid={`selection-annotation-remove-${messageId}-${index}`}
                      className={cn(
                        'inline-flex items-center rounded-sm border border-border bg-card p-1 text-muted-foreground',
                        'shadow-sm transition-colors hover:border-destructive/40 hover:text-destructive',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      )}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
