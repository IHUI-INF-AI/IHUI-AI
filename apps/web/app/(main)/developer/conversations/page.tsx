'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { MessageSquare, Trash2, ChevronDown, ChevronUp, Pencil, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

// --- 类型定义(与后端 schema 对齐,JSON 序列化后 Date → string) ---
interface Conversation {
  id: string
  conversationId: string
  title: string | null
  model: string | null
  messageCount: number
  totalTokens: number
  totalCostCents: number
  lastMessageAt: string
  createdAt: string
}

interface RelayMessage {
  id: string
  role: string
  content: string
  model: string | null
  totalTokens: number
  costCents: number
  latencyMs: number | null
  status: string
  errorMessage: string | null
  createdAt: string
}

interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 20

export default function ConversationsPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState('')

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })
  const num = new Intl.NumberFormat(locale)

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['developer', 'conversations', page],
    queryFn: () =>
      api<Paginated<Conversation>>(
        `/api/developer/conversations?page=${page}&pageSize=${PAGE_SIZE}`,
      ).catch(() => ({ items: [], total: 0, page, pageSize: PAGE_SIZE }) as Paginated<Conversation>),
  })

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ['developer', 'conversations', expandedId, 'messages'],
    queryFn: () =>
      api<Paginated<RelayMessage>>(
        `/api/developer/conversations/${expandedId}/messages?pageSize=100`,
      ).catch(() => ({ items: [], total: 0, page: 1, pageSize: 100 }) as Paginated<RelayMessage>),
    enabled: !!expandedId,
  })

  const delMut = useMutation({
    mutationFn: (conversationId: string) =>
      api(`/api/developer/conversations/${conversationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'conversations'] })
      toast.success('会话已删除')
      setExpandedId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const titleMut = useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      api(`/api/developer/conversations/${conversationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['developer', 'conversations'] })
      toast.success('标题已更新')
      setEditingId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function startEdit(c: Conversation) {
    setEditingId(c.conversationId)
    setEditTitle(c.title ?? '')
  }

  function saveEdit() {
    if (editingId && editTitle.trim()) {
      titleMut.mutate({ conversationId: editingId, title: editTitle.trim() })
    }
  }

  function toggleExpand(conversationId: string) {
    setExpandedId((prev) => (prev === conversationId ? null : conversationId))
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <MessageSquare className="h-5 w-5 text-primary" />
          对话历史
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          通过 API Key 调用时附带的 conversation_id 自动归档的对话记录
        </p>
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无对话记录</p>
          ) : (
            <div className="space-y-2 p-3">
              {items.map((c) => {
                const isExpanded = expandedId === c.conversationId
                const isEditing = editingId === c.conversationId
                return (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleExpand(c.conversationId)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit()
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={saveEdit}
                              disabled={titleMut.isPending}
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p
                              className="cursor-pointer truncate text-sm font-medium hover:text-primary"
                              onClick={() => toggleExpand(c.conversationId)}
                            >
                              {c.title ?? '未命名会话'}
                            </p>
                            <button
                              onClick={() => startEdit(c)}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              aria-label="编辑标题"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {c.model && (
                            <span className="rounded bg-muted px-1.5 py-0.5">{c.model}</span>
                          )}
                          <span>{num.format(c.messageCount)} 条消息</span>
                          <span>{num.format(c.totalTokens)} token</span>
                          <span>{dateFmt.format(new Date(c.lastMessageAt))}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('确认删除该会话?所有消息将一并删除。')) {
                              delMut.mutate(c.conversationId)
                            }
                          }}
                          disabled={delMut.isPending}
                          className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
                        {messagesLoading ? (
                          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            加载消息...
                          </div>
                        ) : (messagesData?.items ?? []).length === 0 ? (
                          <p className="py-2 text-xs text-muted-foreground">暂无消息</p>
                        ) : (
                          (messagesData?.items ?? []).map((m) => (
                            <div
                              key={m.id}
                              className={cn(
                                'rounded-md p-2',
                                m.role === 'user'
                                  ? 'bg-background'
                                  : m.role === 'assistant'
                                    ? 'bg-primary/5'
                                    : 'bg-muted',
                              )}
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {m.role === 'user'
                                    ? '用户'
                                    : m.role === 'assistant'
                                      ? '助手'
                                      : '系统'}
                                </span>
                                {m.model && (
                                  <span className="text-xs text-muted-foreground">{m.model}</span>
                                )}
                                <span
                                  className={cn(
                                    'rounded px-1 text-xs',
                                    m.status === 'success'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400',
                                  )}
                                >
                                  {m.status === 'success' ? '成功' : '错误'}
                                </span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {dateFmt.format(new Date(m.createdAt))}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm">
                                {m.content}
                              </p>
                              {m.errorMessage && (
                                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                  {m.errorMessage}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{num.format(m.totalTokens)} token</span>
                                {m.latencyMs !== null && <span>{m.latencyMs} ms</span>}
                                {m.costCents > 0 && (
                                  <span>¥{(m.costCents / 100).toFixed(4)}</span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
