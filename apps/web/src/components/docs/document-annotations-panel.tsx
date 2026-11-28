// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Loader2, MessageSquare, RefreshCw, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import {
  createDocumentAnnotation,
  deleteDocumentAnnotation,
  fetchDocumentAnnotations,
  updateDocumentAnnotation,
  type DocumentAnnotationRecord,
} from '@/lib/document-annotations'
import { emitAnchorReference } from '@/components/chat/annotation-anchor'
import { useOptionalPaneId } from '@/stores/chat-pane-context'
import type { AnnotationAnchor } from '@ihui/shared/chat/annotation-anchors'
import { cn } from '@/lib/utils'

export type { DocumentAnnotationRecord } from '@/lib/document-annotations'

/**
 * 文档级批注/评论线程(2026-11-27 立)。
 *
 * D91 的选区锚点只负责“选中 → 坐标 → 进入输入框”;本面板补服务端线程:
 *  - 同一 documentId 下所有登录用户共享;
 *  - 主批注保留锚点 label/excerpt/结构化 anchor,回复只挂 parentId;
 *  - resolved 状态是线程级,可重新打开。
 *
 * 不在这里做锚点采集:采集仍归 PDFViewer/OfficePreview/pptx-visual,
 * 本面板只消费 API,避免四类预览器各写一套线程 UI。
 */

interface Props {
  documentId: string
  documentTitle?: string
  /** 外部(锚点自动保存)新增后递增,触发重新拉取 */
  refreshKey?: number
  /** 从页内 pin 跳转过来时要聚焦的线程根 id */
  focusId?: string | null
  /** 线程发生增删改后通知宿主刷新页内 pin */
  onMutated?: () => void
  className?: string
  onClose?: () => void
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DocumentAnnotationsPanel({
  documentId,
  documentTitle,
  refreshKey = 0,
  focusId = null,
  onMutated,
  className,
  onClose,
}: Props) {
  const [items, setItems] = React.useState<DocumentAnnotationRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [composer, setComposer] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [replyTarget, setReplyTarget] = React.useState<string | null>(null)
  const [replyBody, setReplyBody] = React.useState('')
  const [replyBusy, setReplyBusy] = React.useState(false)
  const asideRef = React.useRef<HTMLElement>(null)
  const paneId = useOptionalPaneId()

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchDocumentAnnotations(documentId)
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '批注加载失败')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  React.useEffect(() => {
    void load()
  }, [load, refreshKey])

  const roots = React.useMemo(
    () =>
      items
        .filter((item) => !item.parentId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items],
  )
  const aiRoots = React.useMemo(
    () => roots.filter((root) => root.origin === 'ai' && root.anchor),
    [roots],
  )
  const replies = React.useMemo(() => {
    const map = new Map<string, DocumentAnnotationRecord[]>()
    for (const item of items) {
      if (!item.parentId) continue
      const list = map.get(item.parentId) ?? []
      list.push(item)
      map.set(item.parentId, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [items])

  // 页内 pin 点进来时把对应线程滚到可视区;线程列表是异步加载的,必须等 items 到齐再找。
  React.useEffect(() => {
    if (!focusId) return
    const timer = window.setTimeout(() => {
      const target = asideRef.current?.querySelector<HTMLElement>(
        `[data-annotation-id="${focusId}"]`,
      )
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      target?.focus({ preventScroll: true })
    }, 60)
    return () => window.clearTimeout(timer)
  }, [focusId, items])

  const submitRoot = async () => {
    const text = composer.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const created = await createDocumentAnnotation({ documentId, body: text })
      setItems((current) => [...current, created])
      setComposer('')
      onMutated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '批注保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  const submitReply = async (rootId: string) => {
    const text = replyBody.trim()
    if (!text || replyBusy) return
    setReplyBusy(true)
    setError('')
    try {
      const created = await createDocumentAnnotation({ documentId, body: text, parentId: rootId })
      setItems((current) => [...current, created])
      setReplyBody('')
      setReplyTarget(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '回复失败')
    } finally {
      setReplyBusy(false)
    }
  }

  const toggleStatus = async (root: DocumentAnnotationRecord) => {
    const next = root.status === 'resolved' ? 'open' : 'resolved'
    setError('')
    try {
      await updateDocumentAnnotation(root.id, documentId, next)
      setItems((current) =>
        current.map((item) =>
          item.id === root.id
            ? { ...item, status: next, updatedAt: new Date().toISOString() }
            : item,
        ),
      )
      onMutated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '状态更新失败')
    }
  }

  const removeRoot = async (root: DocumentAnnotationRecord) => {
    if (!window.confirm('删除这条批注及其全部回复?')) return
    setError('')
    try {
      await deleteDocumentAnnotation(root.id, documentId)
      setItems((current) =>
        current.filter((item) => item.id !== root.id && item.parentId !== root.id),
      )
      onMutated?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  /**
   * 全部 AI 结论一次带回主对话:用户不必逐条点「交给主 AI」。
   * 这不是把 finding 摘要成一段散文——每条都保留自己的坐标 label/证据,
   * 主 AI 才能按优先级给出一份可执行修订计划,而不是泛泛建议。
   */
  const handoffAllAi = () => {
    const first = aiRoots[0]
    if (!first?.anchor) return
    const rawAnchor = first.anchor as Record<string, unknown>
    const lines = aiRoots.map(
      (root, index) =>
        `${index + 1}. [${root.label || 'AI 预审'}] ${root.body.slice(0, 1000)}`,
    )
    emitAnchorReference({
      text: [
        `【${documentTitle || '文档'} · AI 全文预审，共 ${aiRoots.length} 条】`,
        ...lines,
        '请基于以上全部 AI 预审结论，按优先级给出可执行的修订计划，并逐项标注对应的段落/单元格；同时列出需要补充的证据和复核动作。',
      ].join('\n\n'),
      anchor: first.anchor as AnnotationAnchor,
      source: 'ai-finding',
      paneId,
      page: typeof rawAnchor.page === 'number' ? rawAnchor.page : undefined,
      slide: typeof rawAnchor.slide === 'number' ? rawAnchor.slide : undefined,
      element: typeof rawAnchor.element === 'string' ? rawAnchor.element : undefined,
      excerpt: first.excerpt ?? undefined,
      note: `全部 AI 预审结论 ${aiRoots.length} 条`,
      autoSend: true,
      autoSendPrompt: '请基于这份文档的全部 AI 预审结论，按优先级给出可执行的修订计划，并逐项标注对应的段落/单元格。',
    })
  }

  return (
    <aside
      ref={asideRef}
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-stroke-subtle bg-background shadow-xl',
        className,
      )}
      data-testid="document-annotations-panel"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-stroke-subtle p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            文档批注
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {roots.length}
            </span>
          </div>
          {documentTitle ? (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={documentTitle}>
              {documentTitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {aiRoots.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handoffAllAi}
              className="h-7 gap-1 px-1.5 text-[10px] text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
              title="把全部 AI 预审结论一次带回主 AI 对话"
              data-testid="annotation-ai-handoff-all"
            >
              <Sparkles className="h-3.5 w-3.5" />
              全部交给主 AI
              <span className="rounded-full bg-violet-500/10 px-1 text-[9px]">{aiRoots.length}</span>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            aria-label="刷新批注"
            title="刷新批注"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {onClose ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="关闭批注面板"
              title="关闭批注面板"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 space-y-1.5 border-b border-stroke-subtle p-3">
        <textarea
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="写一条文档批注,或先在正文选中文字再添加到任务…"
          className="w-full resize-none rounded-md border border-stroke-subtle bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stroke-focus"
          data-testid="annotation-composer"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">选中正文后“添加到任务”会自动存为锚点批注</span>
          <Button
            size="sm"
            onClick={() => void submitRoot()}
            disabled={!composer.trim() || submitting}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            发表批注
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mx-3 mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在加载批注
          </div>
        ) : roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
            <MessageSquare className="h-5 w-5 opacity-40" />
            <p>还没有批注</p>
            <p className="text-[10px]">点查看器里的「AI 预审」让 AI 自动落点,也可选中文字留下人工上下文</p>
          </div>
        ) : (
          roots.map((root) => {
            const rootReplies = replies.get(root.id) ?? []
            const focused = root.id === focusId
            return (
              <article
                key={root.id}
                tabIndex={-1}
                className={cn(
                  'rounded-lg border p-2.5 outline-none transition-shadow',
                  root.status === 'resolved'
                    ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : 'border-stroke-subtle bg-muted/20',
                  focused && 'ring-2 ring-violet-500/70 ring-offset-1',
                )}
                data-testid="document-annotation-thread"
                data-annotation-id={root.id}
                data-annotation-status={root.status}
                data-annotation-focused={focused ? 'true' : undefined}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{root.author}</span>
                  {root.origin === 'ai' ? (
                    <span className="rounded bg-violet-500/10 px-1 py-0.5 font-medium text-violet-700 dark:text-violet-300">
                      AI 预审
                    </span>
                  ) : null}
                  <span>{formatTime(root.createdAt)}</span>
                  {root.status === 'resolved' ? (
                    <span className="rounded bg-emerald-500/10 px-1 py-0.5 text-emerald-700 dark:text-emerald-300">
                      已解决
                    </span>
                  ) : null}
                </div>
                {root.label ? (
                  <span className="mt-1.5 inline-flex max-w-full truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {root.label}
                  </span>
                ) : null}
                {root.excerpt ? (
                  <blockquote className="mt-1.5 line-clamp-2 border-l-2 border-stroke-subtle pl-2 text-[10px] text-muted-foreground">
                    {root.excerpt}
                  </blockquote>
                ) : null}
                <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                  {root.body}
                </p>

                {rootReplies.length > 0 ? (
                  <div className="mt-2 space-y-1.5 border-l border-stroke-subtle pl-2">
                    {rootReplies.map((reply) => (
                      <div key={reply.id} className="text-[11px]">
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground">{reply.author}</span>
                          <span>{formatTime(reply.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-foreground">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {replyTarget === root.id ? (
                  <div className="mt-2 space-y-1">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      maxLength={4000}
                      placeholder="回复这条批注…"
                      className="w-full resize-none rounded-md border border-stroke-subtle bg-background px-2 py-1 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-stroke-focus"
                      data-testid="annotation-reply-input"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        onClick={() => {
                          setReplyTarget(null)
                          setReplyBody('')
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        disabled={!replyBody.trim() || replyBusy}
                        onClick={() => void submitReply(root.id)}
                      >
                        {replyBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        发送
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {root.origin === 'ai' && root.anchor ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-[10px] text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
                      title="把这条 AI 结论带回主 AI 对话继续处理"
                      onClick={() => {
                        const rawAnchor = root.anchor as Record<string, unknown>
                        emitAnchorReference({
                          text: `[${root.label || 'AI 预审'}] ${root.body.slice(0, 1200)}\n\n请基于这条 AI 预审意见,给出可执行的修订方案,并指出需要补充的证据。`,
                          anchor: rawAnchor as unknown as AnnotationAnchor,
                          source: 'ai-finding',
                          paneId,
                          page: typeof rawAnchor.page === 'number' ? rawAnchor.page : undefined,
                          slide: typeof rawAnchor.slide === 'number' ? rawAnchor.slide : undefined,
                          element:
                            typeof rawAnchor.element === 'string' ? rawAnchor.element : undefined,
                          excerpt: root.excerpt ?? undefined,
                          note: root.body,
                          autoSend: true,
                          autoSendPrompt: '请基于这条 AI 预审结论，给出可执行的修订方案。',
                        })
                      }}
                      data-testid="annotation-ai-handoff"
                    >
                      <Sparkles className="h-3 w-3" />
                      交给主 AI
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[10px]"
                    onClick={() => {
                      setReplyTarget(root.id)
                      setReplyBody('')
                    }}
                  >
                    <MessageSquare className="h-3 w-3" />
                    回复
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-1.5 text-[10px]"
                    onClick={() => void toggleStatus(root)}
                  >
                    {root.status === 'resolved' ? (
                      <>
                        <RotateCcw className="h-3 w-3" />
                        重新打开
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        标记已解决
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-rose-600"
                    onClick={() => void removeRoot(root)}
                    aria-label="删除批注"
                    title="删除批注"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </article>
            )
          })
        )}
      </div>
    </aside>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
