'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, Check, X, Loader2, Send, Plus, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { DataTable, type Column, Badge } from '@/components/data'
import { cn } from '@/lib/utils'
import { createWebSocketHook } from '@/hooks/create-websocket-hook'

interface DemandRow {
  id: string
  agentId: string
  agentName: string
  startName: string
  desc: string
  startTime: string
  examineTime: string
  status: string
  agentCategory?: Record<string, string>
  [k: string]: unknown
}
interface ChatMsg {
  ques: string
  content: string
}
interface WsChatMsg {
  type?: string
  event?: string
  data?: { content_type?: string; content?: string }
}

function buildChatWsUrl(token: string | null): string {
  if (typeof window === 'undefined' || !token) return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = process.env.NEXT_PUBLIC_WS_CHAT_URL || '/ws/chat'
  return `${proto}//${window.location.host}${path}?token=${encodeURIComponent(token)}`
}
function isWsChatMsg(d: unknown): d is WsChatMsg {
  return typeof d === 'object' && d !== null && ('type' in d || 'event' in d)
}
const useChatWs = createWebSocketHook<WsChatMsg>({
  urlBuilder: buildChatWsUrl,
  messageGuard: isWsChatMsg,
})

const EDIT_FIELDS: { key: string; label: string; type?: 'date' | 'textarea' }[] = [
  { key: 'agentId', label: 'Agent ID' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'categoryId', label: '分类ID' },
  { key: 'startTime', label: '开始时间', type: 'date' },
  { key: 'startUser', label: '发起用户' },
  { key: 'startPhone', label: '发起电话' },
  { key: 'startName', label: '发起人' },
  { key: 'examineUser', label: '审核人' },
  { key: 'examineUserId', label: '审核人ID' },
  { key: 'examineTime', label: '审核时间', type: 'date' },
  { key: 'desc', label: '描述', type: 'textarea' },
  { key: 'follow', label: '跟进', type: 'textarea' },
  { key: 'agentAvatar', label: '头像', type: 'textarea' },
  { key: 'prologue', label: '开场白', type: 'textarea' },
]
const SEARCH_FIELDS: { key: string; label: string }[] = [
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentCreatTime', label: '创建时间' },
  { key: 'reviewTime', label: '审核时间' },
  { key: 'saleType', label: '销售方式' },
  { key: 'agentPeople', label: '面向群体' },
  { key: 'developer', label: '开发者' },
  { key: 'reviewName', label: '审核人' },
  { key: 'reviewStatus', label: '审核状态' },
]
const AGENT_INFO: { key: string; label: string }[] = [
  { key: 'group', label: '序号' },
  { key: 'type', label: '状态' },
  { key: 'agentName', label: 'Agent名称' },
  { key: 'agentDesc', label: '描述' },
  { key: 'agentImage', label: '图片' },
  { key: 'agentType', label: '类型' },
  { key: 'createTime', label: '创建时间' },
  { key: 'agentSaleMethod', label: '销售方式' },
  { key: 'account', label: '价格' },
  { key: 'agentFreeTimeEnd', label: '免费结束' },
  { key: 'discountMonth', label: '折扣' },
  { key: 'agentTargetGroup', label: '目标群体' },
  { key: 'createName', label: '开发者' },
]
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function DemandAuditPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState<Record<string, string>>({})
  const [page, setPage] = React.useState(1)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editForm, setEditForm] = React.useState<Record<string, string>>({})
  const [editId, setEditId] = React.useState<string | null>(null)
  const [approvalOpen, setApprovalOpen] = React.useState(false)
  const [agentInfo, setAgentInfo] = React.useState<Record<string, string>>({})
  const [approvalId, setApprovalId] = React.useState('')
  const [botId, setBotId] = React.useState('')
  const [remark, setRemark] = React.useState('')
  const [chatMsgs, setChatMsgs] = React.useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = React.useState('')
  const sendingRef = React.useRef('')
  const { send, isConnected, lastMessage } = useChatWs()

  React.useEffect(() => {
    if (!lastMessage) return
    if (lastMessage.type === 'completed') return
    if (
      (lastMessage.event === 'conversation.message.delta' ||
        lastMessage.event === 'conversation.message.completed') &&
      lastMessage.data?.content_type === 'text'
    ) {
      const c = lastMessage.data.content || ''
      setChatMsgs((prev) =>
        prev.map((m) => (m.ques === sendingRef.current ? { ...m, content: m.content + c } : m)),
      )
    }
  }, [lastMessage])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'demand-audit', search, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: '20' })
      Object.entries(search)
        .filter(([, v]) => v)
        .forEach(([k, v]) => qs.set(k, v))
      return api<{ list: DemandRow[]; total: number }>(`/api/admin/examine?${qs}`)
    },
  })

  const editMut = useMutation({
    mutationFn: () =>
      editId
        ? api(`/api/admin/examine/${editId}`, { method: 'PUT', body: JSON.stringify(editForm) })
        : api('/api/admin/examine', { method: 'POST', body: JSON.stringify(editForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
      setEditOpen(false)
    },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/admin/examine/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] }),
  })
  const approveMut = useMutation({
    mutationFn: (action: 'pass' | 'reject') =>
      api(action === 'pass' ? '/api/admin/examine/pass' : '/api/admin/examine/reject', {
        method: 'POST',
        body: JSON.stringify({ id: approvalId, remark }),
      }),
    onSuccess: () => {
      toast.success('操作成功')
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
      setApprovalOpen(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(row?: DemandRow) {
    setEditId(row?.id ?? null)
    setEditForm(row ? ({ ...row } as Record<string, string>) : {})
    setEditOpen(true)
  }
  function openApproval(row: DemandRow) {
    setApprovalId(row.id)
    setBotId(row.agentId || '')
    setAgentInfo(row.agentCategory ?? {})
    setRemark('')
    setChatMsgs([])
    setApprovalOpen(true)
  }
  function sendChat() {
    if (!chatInput.trim()) return
    sendingRef.current = chatInput
    setChatMsgs((prev) => [...prev, { ques: chatInput, content: '' }])
    send(
      JSON.stringify({
        bot_id: botId,
        user_id: '123456789',
        stream: true,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: chatInput, content_type: 'text' }],
      }),
    )
    setChatInput('')
  }

  const list = data?.list ?? []
  const columns: Column<DemandRow>[] = [
    {
      key: 'agentName',
      title: 'Agent名称',
      render: (d) => <span className="font-medium">{d.agentName || '-'}</span>,
    },
    {
      key: 'startName',
      title: '发起人',
      render: (d) => <span className="text-muted-foreground">{d.startName || '-'}</span>,
    },
    {
      key: 'desc',
      title: '描述',
      render: (d) => <span className="text-muted-foreground">{(d.desc || '-').slice(0, 30)}</span>,
    },
    {
      key: 'examineTime',
      title: '审核时间',
      render: (d) => <span className="text-muted-foreground">{d.examineTime || '-'}</span>,
    },
    {
      key: 'status',
      title: '状态',
      render: (d) => (
        <Badge
          variant={
            d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning'
          }
        >
          {d.status === 'approved' ? '已通过' : d.status === 'rejected' ? '已驳回' : '待审核'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      align: 'right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openApproval(d)}>
            <Check className="h-4 w-4" />
            审批
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>
            <Edit className="h-4 w-4" />
            编辑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              if (confirm('确认删除?')) delMut.mutate(d.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            需求审核
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            审核需求,支持WebSocket聊天、编辑、审批
          </p>
        </div>
        <Button size="sm" onClick={() => openEdit()}>
          <Plus className="h-4 w-4" />
          新增
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 sm:grid-cols-4">
        {SEARCH_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="text-xs">{f.label}</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={search[f.key] ?? ''}
              onChange={(e) => {
                setSearch({ ...search, [f.key]: e.target.value })
                setPage(1)
              }}
              placeholder={f.label}
            />
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={list}
        rowKey={(d) => d.id}
        loading={isLoading}
        pagination={{ page, pageSize: 20, total: data?.total ?? 0 }}
        onPageChange={setPage}
      />

      <Dialog
        open={editOpen}
        onOpenChange={(o) => (o ? setEditOpen(true) : !editMut.isPending && setEditOpen(false))}
      >
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              editMut.mutate()
            }}
            className="space-y-3"
          >
            <DialogHeader>
              <DialogTitle>{editId ? '编辑需求' : '新增需求'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                  <Label className="text-xs">{f.label}</Label>
                  {f.type === 'textarea' ? (
                    <textarea
                      className={`${textareaClass} mt-1`}
                      rows={2}
                      value={editForm[f.key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    />
                  ) : (
                    <Input
                      className="mt-1 h-8 text-sm"
                      type={f.type === 'date' ? 'date' : 'text'}
                      value={editForm[f.key] ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={editMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={editMut.isPending}>
                {editMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approvalOpen}
        onOpenChange={(o) => (o ? setApprovalOpen(true) : setApprovalOpen(false))}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>审批详情</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isConnected ? 'bg-emerald-500' : 'bg-muted-foreground/50',
                  )}
                />
                {isConnected ? 'WebSocket已连接' : '未连接'}
              </div>
              <div
                className="flex-1 space-y-2 overflow-y-auto rounded-md border p-2"
                style={{ minHeight: '200px', maxHeight: '300px' }}
              >
                {chatMsgs.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">输入消息开始对话</p>
                ) : (
                  chatMsgs.map((m, i) => (
                    <div key={i} className="space-y-1">
                      <div className="rounded-md bg-primary/10 px-2 py-1 text-xs">{m.ques}</div>
                      {m.content && (
                        <div className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                          {m.content}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-1">
                <Input
                  className="h-8 text-sm"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendChat()
                    }
                  }}
                  placeholder="输入消息..."
                />
                <Button size="icon" type="button" onClick={sendChat} disabled={!isConnected}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="space-y-1.5 rounded-md border p-3">
                {AGENT_INFO.map((f) => (
                  <div key={f.key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium">{agentInfo[f.key] || '-'}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label className="text-xs">审核意见</Label>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="请输入审核意见..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate('pass')}
                  >
                    <Check className="h-4 w-4" />
                    通过
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate('reject')}
                  >
                    <X className="h-4 w-4" />
                    驳回
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
