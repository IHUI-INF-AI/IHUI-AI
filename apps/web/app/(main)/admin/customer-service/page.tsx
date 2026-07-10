'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Ticket, Headphones, Tag } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

// =============================================================================
// 类型定义
// =============================================================================

type TicketStatus = 'pending' | 'open' | 'resolved' | 'closed' | 'rejected'
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
type AgentStatus = 'online' | 'busy' | 'away' | 'offline'

interface Category {
  id: string
  name: string
  slug: string
  description?: string | null
  sortOrder: number
}

interface Ticket {
  id: string
  ticketNo: string
  userId: string
  categoryId: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assigneeId: string | null
  source: string
  attachments: unknown[]
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

interface Agent {
  id: string
  userId: string
  nickname: string
  avatar: string | null
  status: AgentStatus
  maxConcurrent: number
  currentLoad: number
  skills: string[]
  createdAt: string
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

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  urgent: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  online: '在线',
  busy: '忙碌',
  away: '离开',
  offline: '离线',
}

const AGENT_STATUS_BADGE: Record<AgentStatus, string> = {
  online: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  busy: 'bg-red-500/10 text-red-600 dark:text-red-400',
  away: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  offline: 'bg-muted text-muted-foreground',
}

// 合法状态流转
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  pending: ['open', 'rejected', 'closed'],
  open: ['resolved', 'closed', 'rejected'],
  resolved: ['closed', 'open'],
  rejected: ['open', 'closed'],
  closed: ['open'],
}

const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

// =============================================================================
// 主页面
// =============================================================================

export default function AdminCustomerServicePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">客服管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">工单管理、坐席分配与服务评级</p>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-4 w-4" /> 工单管理
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5">
            <Headphones className="h-4 w-4" /> 坐席管理
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5">
            <Tag className="h-4 w-4" /> 分类管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <TicketsPanel />
        </TabsContent>
        <TabsContent value="agents" className="mt-4">
          <AgentsPanel />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// =============================================================================
// 工单管理面板
// =============================================================================

function TicketsPanel() {
  const qc = useQueryClient()
  const [status, setStatus] = React.useState('all')
  const [priority, setPriority] = React.useState('all')
  const [selected, setSelected] = React.useState<Ticket | null>(null)
  const [open, setOpen] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-tickets', status, priority],
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      if (priority !== 'all') qs.set('priority', priority)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return api<{ list: Ticket[]; total: number }>(`/api/admin/customer-service/tickets${suffix}`)
    },
  })

  const list = data?.list ?? []

  function openDetail(t: Ticket) {
    setSelected(t)
    setOpen(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优先级</SelectItem>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">工单号</th>
              <th className="px-4 py-2.5 font-medium">标题</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">优先级</th>
              <th className="px-4 py-2.5 font-medium">创建时间</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <Ticket className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无工单
                </td>
              </tr>
            ) : (
              list.map((t) => (
                <tr key={t.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => openDetail(t)}>
                  <td className="px-4 py-2.5 font-mono text-xs">{t.ticketNo}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 font-medium">{t.title}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[t.status])}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_BADGE[t.priority])}>
                      {PRIORITY_LABEL[t.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(t) }}>
                      处理
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <TicketDetailDialog
          ticket={selected}
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) {
              qc.invalidateQueries({ queryKey: ['admin', 'cs-tickets'] })
              setSelected(null)
            }
          }}
        />
      )}
    </div>
  )
}

// =============================================================================
// 工单详情对话框（分配 / 状态流转 / 回复 / 评论列表）
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
  const [assignAgentId, setAssignAgentId] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: commentsData } = useQuery({
    queryKey: ['admin', 'cs-ticket-comments', ticket.id],
    queryFn: () => api<{ list: Comment[] }>(`/api/admin/customer-service/tickets/${ticket.id}/comments`),
    enabled: open,
  })

  const { data: agentsData } = useQuery({
    queryKey: ['admin', 'cs-agents'],
    queryFn: () => api<{ list: Agent[] }>(`/api/admin/customer-service/agents`),
    enabled: open,
  })

  const replyMut = useMutation({
    mutationFn: () =>
      api(`/api/admin/customer-service/tickets/${ticket.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: reply.trim() }),
      }),
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['admin', 'cs-ticket-comments', ticket.id] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const assignMut = useMutation({
    mutationFn: () =>
      api(`/api/admin/customer-service/tickets/${ticket.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId: assignAgentId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cs-tickets'] })
      setAssignAgentId('')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function doTransition(to: TicketStatus) {
    setErr(null)
    api(`/api/admin/customer-service/tickets/${ticket.id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ status: to }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ['admin', 'cs-tickets'] }))
      .catch((e: Error) => setErr(e.message))
  }

  const comments = commentsData?.list ?? []
  const agents = agentsData?.list ?? []
  const allowedNext = TRANSITIONS[ticket.status] ?? []

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
            <span className="ml-2">优先级：</span>
            <span className={cn('ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_BADGE[ticket.priority])}>
              {PRIORITY_LABEL[ticket.priority]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

          {/* 工单描述 */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">问题描述</div>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* 状态流转 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">状态流转：</span>
            {allowedNext.length === 0 ? (
              <span className="text-sm text-muted-foreground">无可流转状态</span>
            ) : (
              allowedNext.map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => doTransition(s)}>
                  → {STATUS_LABEL[s]}
                </Button>
              ))
            )}
          </div>

          {/* 分配坐席 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">分配坐席：</span>
            <Select value={assignAgentId} onValueChange={setAssignAgentId}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="选择坐席" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nickname}（{AGENT_STATUS_LABEL[a.status]}，{a.currentLoad}/{a.maxConcurrent}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!assignAgentId || assignMut.isPending}
              onClick={() => { setErr(null); assignMut.mutate() }}
            >
              {assignMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              分配
            </Button>
          </div>

          {/* 评论列表 */}
          <div className="space-y-2">
            <div className="text-sm font-medium">回复记录</div>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无回复</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                {comments.map((c) => (
                  <div key={c.id} className={cn('rounded px-2 py-1.5 text-sm', c.isAdmin ? 'bg-blue-500/5' : 'bg-muted/40')}>
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{c.isAdmin ? '客服' : '用户'}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 客服回复 */}
          <div className="space-y-2">
            <Label htmlFor="reply">客服回复</Label>
            <textarea
              id="reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className={textareaClass}
              placeholder="输入回复内容..."
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={!reply.trim() || replyMut.isPending} onClick={() => { setErr(null); replyMut.mutate() }}>
                {replyMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                发送回复
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// 坐席管理面板
// =============================================================================

function AgentsPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ userId: '', nickname: '', maxConcurrent: 5 })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-agents'],
    queryFn: () => api<{ list: Agent[] }>(`/api/admin/customer-service/agents`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ agent: Agent }>('/api/admin/customer-service/agents', {
        method: 'POST',
        body: JSON.stringify({
          userId: form.userId,
          nickname: form.nickname,
          maxConcurrent: form.maxConcurrent,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cs-agents'] })
      setOpen(false)
      setForm({ userId: '', nickname: '', maxConcurrent: 5 })
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  function updateStatus(id: string, status: AgentStatus) {
    api(`/api/admin/customer-service/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
      .then(() => qc.invalidateQueries({ queryKey: ['admin', 'cs-agents'] }))
      .catch((e: Error) => setErr(e.message))
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ 添加坐席</Button>
      </div>

      {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">昵称</th>
              <th className="px-4 py-2.5 font-medium">状态</th>
              <th className="px-4 py-2.5 font-medium">负载</th>
              <th className="px-4 py-2.5 font-medium">技能</th>
              <th className="px-4 py-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <Headphones className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无坐席
                </td>
              </tr>
            ) : (
              list.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 font-medium">{a.nickname}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', AGENT_STATUS_BADGE[a.status])}>
                      {AGENT_STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {a.currentLoad}/{a.maxConcurrent}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.skills.join(', ') || '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Select value="" onValueChange={(v) => v && updateStatus(a.id, v as AgentStatus)}>
                      <SelectTrigger className="h-8 w-[100px]">
                        <SelectValue placeholder="切换状态" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AGENT_STATUS_LABEL) as AgentStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {AGENT_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : setOpen(false))}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setErr(null)
              createMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>添加坐席</DialogTitle>
              <DialogDescription>将用户指定为客服坐席</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="agent-userId">用户 ID</Label>
              <Input
                id="agent-userId"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="UUID 格式的用户 ID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-nickname">坐席昵称</Label>
              <Input
                id="agent-nickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-max">最大并发会话数</Label>
              <Input
                id="agent-max"
                type="number"
                min={1}
                max={100}
                value={form.maxConcurrent}
                onChange={(e) => setForm({ ...form, maxConcurrent: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// =============================================================================
// 分类管理面板
// =============================================================================

function CategoriesPanel() {
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', slug: '', description: '', sortOrder: 0 })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-categories'],
    queryFn: () => api<{ list: Category[] }>(`/api/customer-service/categories`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ category: Category }>('/api/admin/customer-service/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          sortOrder: form.sortOrder,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cs-categories'] })
      setOpen(false)
      setForm({ name: '', slug: '', description: '', sortOrder: 0 })
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ 添加分类</Button>
      </div>

      {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">名称</th>
              <th className="px-4 py-2.5 font-medium">标识</th>
              <th className="px-4 py-2.5 font-medium">描述</th>
              <th className="px-4 py-2.5 font-medium">排序</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无分类
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.description || '-'}</td>
                  <td className="px-4 py-2.5">{c.sortOrder}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : setOpen(false))}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setErr(null)
              createMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>添加分类</DialogTitle>
              <DialogDescription>创建工单分类</DialogDescription>
            </DialogHeader>
            {err && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Label htmlFor="cat-name">分类名称</Label>
              <Input id="cat-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">标识 (slug)</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder="如：billing"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">描述</Label>
              <Input id="cat-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sort">排序</Label>
              <Input
                id="cat-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
                取消
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
