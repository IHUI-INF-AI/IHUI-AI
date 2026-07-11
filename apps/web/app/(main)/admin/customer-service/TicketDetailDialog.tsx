'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Label,
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
import { useLocale } from 'next-intl'
import {
  type Ticket,
  type Comment,
  type Agent,
  type TicketStatus,
  api,
  STATUS_LABEL,
  STATUS_BADGE,
  PRIORITY_LABEL,
  PRIORITY_BADGE,
  AGENT_STATUS_LABEL,
  TRANSITIONS,
  textareaClass,
} from './types'

export function TicketDetailDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: Ticket
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const locale = useLocale()
  const [reply, setReply] = React.useState('')
  const [assignAgentId, setAssignAgentId] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)

  const { data: commentsData } = useQuery({
    queryKey: ['admin', 'cs-ticket-comments', ticket.id],
    queryFn: () =>
      api<{ list: Comment[] }>(`/api/admin/customer-service/tickets/${ticket.id}/comments`),
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
            <span
              className={cn(
                'ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE[ticket.status],
              )}
            >
              {STATUS_LABEL[ticket.status]}
            </span>
            <span className="ml-2">优先级：</span>
            <span
              className={cn(
                'ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                PRIORITY_BADGE[ticket.priority],
              )}
            >
              {PRIORITY_LABEL[ticket.priority]}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

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
                    {a.nickname}（{AGENT_STATUS_LABEL[a.status]}，{a.currentLoad}/{a.maxConcurrent}
                    ）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!assignAgentId || assignMut.isPending}
              onClick={() => {
                setErr(null)
                assignMut.mutate()
              }}
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
                  <div
                    key={c.id}
                    className={cn(
                      'rounded px-2 py-1.5 text-sm',
                      c.isAdmin ? 'bg-primary/5' : 'bg-muted/40',
                    )}
                  >
                    <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{c.isAdmin ? '客服' : '用户'}</span>
                      <span>{new Intl.DateTimeFormat(locale).format(new Date(c.createdAt))}</span>
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
              <Button
                size="sm"
                disabled={!reply.trim() || replyMut.isPending}
                onClick={() => {
                  setErr(null)
                  replyMut.mutate()
                }}
              >
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
