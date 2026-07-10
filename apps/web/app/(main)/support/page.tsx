'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Ticket, Star, Send, MessageSquare } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义
// =============================================================================

type TicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

interface Category {
  id: string
  name: string
  slug: string
}

interface Ticket {
  id: string
  ticketNo: string
  categoryId: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  source: string
  resolvedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Comment {
  id: string
  ticketId: string
  userId: string
  content: string
  isAdmin: boolean
  attachments: unknown[]
  createdAt: string
}

interface Rating {
  id: string
  rating: number
  comment: string | null
}

// =============================================================================
// API 辅助
// =============================================================================

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

// =============================================================================
// 常量
// =============================================================================

const STATUS_LABEL: Record<TicketStatus, string> = {
  pending: '待处理',
  open: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  rejected: '已驳回',
}

const STATUS_BADGE: Record<TicketStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  open: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// =============================================================================
// 主页面
// =============================================================================

export default function SupportPage() {
  const [tab, setTab] = React.useState<'list' | 'new'>('list')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">客服中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">提交工单、查看进度与服务评价</p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
        {(['list', 'new'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v === 'list' ? '我的工单' : '提交工单'}
          </button>
        ))}
      </div>

      {tab === 'list' ? <TicketList onSwitchToNew={() => setTab('new')} /> : <NewTicketForm onDone={() => setTab('list')} />}
    </div>
  )
}

// =============================================================================
// 工单列表
// =============================================================================

function TicketList({ onSwitchToNew }: { onSwitchToNew: () => void }) {
  const [selected, setSelected] = React.useState<Ticket | null>(null)
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['cs-tickets'],
    queryFn: () => api<{ list: Ticket[]; total: number }>(`/api/customer-service/tickets`),
  })

  const list = data?.list ?? []

  function openDetail(t: Ticket) {
    setSelected(t)
    setOpen(true)
  }

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
          <Ticket className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">暂无工单</p>
          <Button size="sm" variant="outline" onClick={onSwitchToNew} className="mt-1">
            提交第一个工单
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => openDetail(t)}
              className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <Ticket className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.ticketNo} · {new Date(t.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={cn('inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[t.status])}>
                {STATUS_LABEL[t.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <TicketDetailDialog
          ticket={selected}
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) setSelected(null)
          }}
        />
      )}
    </>
  )
}

// =============================================================================
// 工单详情对话框（评论 + 评级）
// =============================================================================

function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const [reply, setReply] = React.useState('')
  const [rating, setRating] = React.useState(5)
  const [ratingComment, setRatingComment] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data } = useQuery({
    queryKey: ['cs-ticket', ticket.id],
    queryFn: () =>
      api<{ ticket: Ticket; comments: Comment[]; rating: Rating | null }>(
        `/api/customer-service/tickets/${ticket.id}`,
      ),
    enabled: open,
  })

  const replyMut = useMutation({
    mutationFn: () =>
      api(`/api/customer-service/tickets/${ticket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: reply.trim() }),
      }),
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['cs-ticket', ticket.id] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const ratingMut = useMutation({
    mutationFn: () =>
      api(`/api/customer-service/tickets/${ticket.id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment: ratingComment.trim() || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-ticket', ticket.id] })
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const comments = data?.comments ?? []
  const existingRating = data?.rating ?? null
  const canRate = (ticket.status === 'resolved' || ticket.status === 'closed') && !existingRating

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{ticket.title}</span>
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNo}</span>
          </DialogTitle>
          <DialogDescription>
            状态：
            <span className={cn('ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[ticket.status])}>
              {STATUS_LABEL[ticket.status]}
            </span>
            <span className="ml-2">优先级：{PRIORITY_LABEL[ticket.priority]}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

          {/* 工单描述 */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">问题描述</div>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* 评论列表 */}
          <div className="space-y-2">
            <div className="text-sm font-medium">沟通记录</div>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无回复</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                {comments.map((c) => (
                  <div key={c.id} className={cn('rounded px-2 py-1.5 text-sm', c.isAdmin ? 'bg-blue-500/5' : 'bg-muted/40')}>
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{c.isAdmin ? '客服' : '我'}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 用户回复 */}
          <div className="space-y-2">
            <Label htmlFor="user-reply">补充回复</Label>
            <textarea
              id="user-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="输入补充内容..."
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!reply.trim() || replyMut.isPending} onClick={() => { setErr(null); replyMut.mutate() }}>
                {replyMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                发送
              </Button>
            </div>
          </div>

          {/* 评级 */}
          {existingRating ? (
            <div className="rounded-md border px-3 py-2">
              <div className="mb-1 flex items-center gap-1 text-sm font-medium">
                <Star className="h-4 w-4 text-amber-500" />
                我的评价
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn('h-4 w-4', n <= existingRating.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40')}
                  />
                ))}
              </div>
              {existingRating.comment && <p className="mt-1 text-sm text-muted-foreground">{existingRating.comment}</p>}
            </div>
          ) : canRate ? (
            <div className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex items-center gap-1 text-sm font-medium">
                <Star className="h-4 w-4 text-amber-500" />
                服务评价
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star
                      className={cn('h-6 w-6 transition-colors', n <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40 hover:text-amber-400')}
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={2}
                className={textareaClass}
                placeholder="评价备注（可选）"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={ratingMut.isPending} onClick={() => { setErr(null); ratingMut.mutate() }}>
                  {ratingMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  提交评价
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 新建工单表单
// =============================================================================

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('')
  const [priority, setPriority] = React.useState<TicketPriority>('medium')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: categoriesData } = useQuery({
    queryKey: ['cs-categories'],
    queryFn: () => api<{ list: Category[] }>(`/api/customer-service/categories`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ ticket: Ticket }>(`/api/customer-service/tickets`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          categoryId: categoryId || null,
          priority,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cs-tickets'] })
      setTitle('')
      setDescription('')
      setCategoryId('')
      setPriority('medium')
      setErr(null)
      onDone()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const categories = categoriesData?.list ?? []

  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErr(null)
            if (title.trim().length < 2) {
              setErr('标题至少 2 个字符')
              return
            }
            if (description.trim().length < 10) {
              setErr('描述至少 10 个字符')
              return
            }
            createMut.mutate()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="t-title">标题</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="简述您的问题"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-category">分类</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="t-category" className="h-9 w-full">
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="t-priority">优先级</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger id="t-priority" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-desc">问题描述</Label>
            <textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="请详细描述您遇到的问题（至少 10 个字符）"
              maxLength={5000}
              rows={6}
              className={textareaClass}
            />
          </div>

          {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDone} disabled={createMut.isPending}>
              取消
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <MessageSquare className="mr-1 h-4 w-4" />
              提交工单
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
