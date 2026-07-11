'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Edit,
  Trash2,
  Download,
  Send,
  MessageCircle,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
import { cn } from '@/lib/utils'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

interface Examine {
  id: string
  agentId: string
  agentName: string | null
  agentAvatar: string | null
  status: number
  startTime: string | null
  startPhone: string | null
  startName: string | null
  examineUser: string | null
  examineTime: string | null
  desc: string | null
  follow: string | null
  prologue: string | null
  reason: string | null
  createdAt: string
}

interface ListData {
  list: Examine[]
  total: number
}

const PAGE_SIZE = 10
const WS_URL = process.env.NEXT_PUBLIC_WS_CHAT_URL || '/ws/chat'
const STATUS_MAP: Record<number, string> = { 0: '待提交', 1: '审核中', 2: '已通过' }
const STATUS_STYLE: Record<number, string> = {
  0: 'bg-amber-500/10 text-amber-600',
  1: 'bg-blue-500/10 text-blue-600',
  2: 'bg-emerald-500/10 text-emerald-600',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const EMPTY = {
  agentId: '',
  agentName: '',
  agentAvatar: '',
  startTime: '',
  startPhone: '',
  startName: '',
  examineUser: '',
  examineTime: '',
  desc: '',
  follow: '',
  prologue: '',
  status: true,
}

interface ChatMsg {
  ques: string
  content: string
}

export default function AdminExaminePage() {
  const qc = useQueryClient()
  const [searchAgent, setSearchAgent] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Examine | null>(null)
  const [form, setForm] = React.useState(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  const [chatOpen, setChatOpen] = React.useState(false)
  const [chatTarget, setChatTarget] = React.useState<Examine | null>(null)
  const [chatMsgs, setChatMsgs] = React.useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = React.useState('')
  const [approvalRemark, setApprovalRemark] = React.useState('')
  const wsRef = React.useRef<WebSocket | null>(null)
  const chatEndRef = React.useRef<HTMLDivElement | null>(null)
  const saveQuesRef = React.useRef('')

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(searchAgent)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [searchAgent])

  React.useEffect(() => {
    if (chatOpen && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs, chatOpen])

  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'examine', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (debounced) qs.set('agentName', debounced)
      return api<ListData>(`/api/admin/examine?${qs.toString()}`)
    },
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        agentId: form.agentId.trim(),
        agentName: form.agentName || undefined,
        agentAvatar: form.agentAvatar || undefined,
        startTime: form.startTime || undefined,
        startPhone: form.startPhone || undefined,
        startName: form.startName || undefined,
        examineUser: form.examineUser || undefined,
        examineTime: form.examineTime || undefined,
        desc: form.desc || undefined,
        follow: form.follow || undefined,
        prologue: form.prologue || undefined,
        status: form.status ? 1 : 0,
      }
      return editing
        ? api(`/api/admin/examine/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/api/admin/examine', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'examine'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/examine/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'examine'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const approveMut = useMutation({
    mutationFn: ({ id, type, remark }: { id: string; type: 'pass' | 'reject'; remark: string }) =>
      api(`/api/admin/examine/${id}/${type === 'pass' ? 'pass' : 'reject'}`, {
        method: 'PUT',
        body: JSON.stringify({ remark }),
      }),
    onSuccess: () => {
      toast.success('操作成功')
      qc.invalidateQueries({ queryKey: ['admin', 'examine'] })
      closeChat()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: Examine) {
    setEditing(item)
    setForm({
      agentId: item.agentId,
      agentName: item.agentName ?? '',
      agentAvatar: item.agentAvatar ?? '',
      startTime: item.startTime ?? '',
      startPhone: item.startPhone ?? '',
      startName: item.startName ?? '',
      examineUser: item.examineUser ?? '',
      examineTime: item.examineTime ?? '',
      desc: item.desc ?? '',
      follow: item.follow ?? '',
      prologue: item.prologue ?? '',
      status: item.status === 1,
    })
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.agentId.trim()) {
      setErr('请输入AgentID')
      return
    }
    saveMut.mutate()
  }
  function handleDelete(item: Examine) {
    if (!window.confirm(`确认删除 ?`)) return
    deleteMut.mutate(item.id)
  }
  function handleExport() {
    exportToExcel(
      '审核管理',
      [
        { key: 'id', title: 'ID' },
        { key: 'agentName', title: 'Agent名称' },
        { key: 'status', title: '状态', formatter: (v) => STATUS_MAP[v as number] ?? '-' },
        { key: 'startTime', title: '开始时间' },
        { key: 'startPhone', title: '联系电话' },
        { key: 'startName', title: '联系人' },
        { key: 'examineUser', title: '审核人' },
        { key: 'desc', title: '描述' },
        { key: 'follow', title: '关注' },
        { key: 'prologue', title: '开场白' },
      ],
      (data?.list ?? []) as unknown as Record<string, unknown>[],
    )
  }

  function openChat(item: Examine) {
    setChatTarget(item)
    setChatOpen(true)
    setChatMsgs([])
    setChatInput('')
    setApprovalRemark('')
  }
  function closeChat() {
    setChatOpen(false)
    setChatTarget(null)
    setChatMsgs([])
    setChatInput('')
    setApprovalRemark('')
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  function sendChat() {
    if (!chatInput.trim() || !chatTarget) return
    const ques = chatInput.trim()
    saveQuesRef.current = ques
    setChatMsgs((prev) => [...prev, { ques, content: '' }])
    setChatInput('')
    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        wsRef.current = new WebSocket(WS_URL)
        wsRef.current.onmessage = (ev) => {
          try {
            const d = JSON.parse(ev.data)
            if (d.type === 'completed') {
              wsRef.current?.close()
              return
            }
            if (
              d.event === 'conversation.message.delta' ||
              d.event === 'conversation.message.completed'
            ) {
              if (d.data?.content_type === 'text') {
                setChatMsgs((prev) =>
                  prev.map((m) =>
                    m.ques === saveQuesRef.current
                      ? { ...m, content: m.content + (d.data.content || '') }
                      : m,
                  ),
                )
              }
            }
          } catch {
            /* ignore parse errors */
          }
        }
        wsRef.current.onopen = () => doSend(ques)
        wsRef.current.onerror = () => toast.error('WebSocket连接失败')
      } else {
        doSend(ques)
      }
    } catch {
      toast.error('WebSocket连接失败')
    }
  }

  function doSend(ques: string) {
    if (!wsRef.current || !chatTarget) return
    wsRef.current.send(
      JSON.stringify({
        bot_id: chatTarget.agentId,
        user_id: '123456789',
        stream: true,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: ques, content_type: 'text' }],
      }),
    )
  }

  function submitApproval(type: 'pass' | 'reject') {
    if (!chatTarget) return
    if (!approvalRemark.trim()) {
      toast.error('请输入审核备注')
      return
    }
    approveMut.mutate({ id: chatTarget.id, type, remark: approvalRemark.trim() })
  }

  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-primary" />
          审核管理
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            导出
          </Button>
          <HasPermi code="ai:examine:add">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="relative w-full max-w-xs">
        <Input
          value={searchAgent}
          onChange={(e) => setSearchAgent(e.target.value)}
          placeholder="搜索Agent名称"
          className="h-9"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4 py-2.5">Agent名称</TableHead>
              <TableHead className="px-4 py-2.5">状态</TableHead>
              <TableHead className="px-4 py-2.5">开始时间</TableHead>
              <TableHead className="px-4 py-2.5">联系电话</TableHead>
              <TableHead className="px-4 py-2.5">审核人</TableHead>
              <TableHead className="px-4 py-2.5">描述</TableHead>
              <TableHead className="px-4 py-2.5 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  加载中…
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="px-4 py-2.5 font-medium">
                    {item.agentName || item.agentId}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLE[item.status] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_MAP[item.status] ?? '-'}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-muted-foreground">
                    {item.startTime || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">{item.startPhone || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5">{item.examineUser || '-'}</TableCell>
                  <TableCell className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">
                    {item.desc || '-'}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {item.status === 1 && (
                        <HasPermi code="ai:examine:edit">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openChat(item)}
                            title="审批"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                      )}
                      <HasPermi code="ai:examine:edit">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                          title="编辑"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                      <HasPermi code="ai:examine:remove">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                          title="删除"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </HasPermi>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑审核' : '新增审核'}</DialogTitle>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>AgentID *</Label>
                <Input
                  value={form.agentId}
                  onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Agent名称</Label>
                <Input
                  value={form.agentName}
                  onChange={(e) => setForm({ ...form, agentName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>开始时间</Label>
                <DatePicker
                  value={form.startTime}
                  onChange={(v) => setForm({ ...form, startTime: v as string })}
                />
              </div>
              <div className="space-y-2">
                <Label>联系电话</Label>
                <Input
                  value={form.startPhone}
                  onChange={(e) => setForm({ ...form, startPhone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>联系人</Label>
                <Input
                  value={form.startName}
                  onChange={(e) => setForm({ ...form, startName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>审核人</Label>
                <Input
                  value={form.examineUser}
                  onChange={(e) => setForm({ ...form, examineUser: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input
                value={form.desc}
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>关注</Label>
              <Input
                value={form.follow}
                onChange={(e) => setForm({ ...form, follow: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>开场白</Label>
              <Input
                value={form.prologue}
                onChange={(e) => setForm({ ...form, prologue: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.status}
                onCheckedChange={(v) => setForm({ ...form, status: v })}
              />
              <Label>启用</Label>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={chatOpen} onOpenChange={(o) => (o ? setChatOpen(true) : closeChat())}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>审批 - {chatTarget?.agentName || chatTarget?.agentId}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 h-[450px]">
            <div className="flex flex-col border rounded-lg">
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMsgs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground mt-10">
                    输入消息开始对话
                  </p>
                ) : (
                  chatMsgs.map((m, i) => (
                    <div key={i} className="space-y-1">
                      <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">{m.ques}</div>
                      {m.content && (
                        <div className="rounded-lg bg-muted px-3 py-2 text-sm">{m.content}</div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2 border-t p-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="输入消息"
                  className="h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChat()
                  }}
                />
                <Button size="sm" onClick={sendChat} type="button">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col border rounded-lg p-3 space-y-3 overflow-y-auto">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AgentID</span>
                  <span>{chatTarget?.agentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开始时间</span>
                  <span>{chatTarget?.startTime || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">联系电话</span>
                  <span>{chatTarget?.startPhone || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">描述</span>
                  <span className="max-w-[150px] truncate">{chatTarget?.desc || '-'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>审核备注 *</Label>
                <textarea
                  value={approvalRemark}
                  onChange={(e) => setApprovalRemark(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="请输入审核备注"
                />
              </div>
              <div className="flex gap-2 mt-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => (approveMut.isPending ? null : submitApproval('pass'))}
                  disabled={approveMut.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  通过
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-destructive"
                  onClick={() => (approveMut.isPending ? null : submitApproval('reject'))}
                  disabled={approveMut.isPending}
                >
                  <XCircle className="h-4 w-4" />
                  拒绝
                </Button>
                <Button size="sm" variant="ghost" onClick={closeChat}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
