// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, Loader2, MessageSquare, RefreshCw, RotateCcw, Send, Trash2, X } from 'lucide-react'
import { Button } from '@ihui/ui-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'

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

export interface DocumentAnnotationRecord {
  id: string
  documentId: string
  parentId: string | null
  author: string
  body: string
  label: string
  anchorKind: string | null
  anchor: Record<string, unknown> | null
  excerpt: string | null
  status: 'open' | 'resolved'
  createdAt: string
  updatedAt: string
}

interface Props {
  documentId: string
  documentTitle?: string
  /** 外部(锚点自动保存)新增后递增,触发重新拉取 */
  refreshKey?: number
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

async function fetchAnnotations(documentId: string): Promise<DocumentAnnotationRecord[]> {
  const res = await fetchApi<DocumentAnnotationRecord[]>(
    `/api/feature-center/documents/annotations?documentId=${encodeURIComponent(documentId)}`,
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function createAnnotation(input: {
  documentId: string
  body: string
  parentId?: string
}): Promise<DocumentAnnotationRecord> {
  const res = await fetchApi<DocumentAnnotationRecord>('/api/feature-center/documents/annotations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

async function updateAnnotation(
  id: string,
  documentId: string,
  status: 'open' | 'resolved',
): Promise<void> {
  const res = await fetchApi(`/api/feature-center/documents/annotations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ documentId, status }),
  })
  if (!res.success) throw new Error(res.error)
}

async function deleteAnnotation(id: string, documentId: string): Promise<void> {
  const res = await fetchApi(`/api/feature-center/documents/annotations/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ documentId }),
  })
  if (!res.success) throw new Error(res.error)
}

export function DocumentAnnotationsPanel({
  documentId,
  documentTitle,
  refreshKey = 0,
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

  const load = React.useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchAnnotations(documentId)
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

  const submitRoot = async () => {
    const text = composer.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const created = await createAnnotation({ documentId, body: text })
      setItems((current) => [...current, created])
      setComposer('')
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
      const created = await createAnnotation({ documentId, body: text, parentId: rootId })
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
      await updateAnnotation(root.id, documentId, next)
      setItems((current) =>
        current.map((item) =>
          item.id === root.id
            ? { ...item, status: next, updatedAt: new Date().toISOString() }
            : item,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '状态更新失败')
    }
  }

  const removeRoot = async (root: DocumentAnnotationRecord) => {
    if (!window.confirm('删除这条批注及其全部回复?')) return
    setError('')
    try {
      await deleteAnnotation(root.id, documentId)
      setItems((current) =>
        current.filter((item) => item.id !== root.id && item.parentId !== root.id),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-stroke-subtle bg-background shadow-xl',
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
            <p className="text-[10px]">在正文选中文字或点击 PPTX 元素,备注后会同步到这里</p>
          </div>
        ) : (
          roots.map((root) => {
            const rootReplies = replies.get(root.id) ?? []
            return (
              <article
                key={root.id}
                className={cn(
                  'rounded-lg border p-2.5',
                  root.status === 'resolved'
                    ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/10'
                    : 'border-stroke-subtle bg-muted/20',
                )}
                data-testid="document-annotation-thread"
                data-annotation-status={root.status}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{root.author}</span>
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
