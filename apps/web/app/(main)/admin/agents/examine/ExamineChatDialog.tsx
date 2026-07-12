'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Send } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, Input, Label } from '@ihui/ui'
import { WS_URL, api } from './helpers'
import type { Examine, ChatMsg } from './types'

interface ExamineChatDialogProps {
  open: boolean
  target: Examine | null
  onClose: () => void
}

export function ExamineChatDialog({ open, target, onClose }: ExamineChatDialogProps) {
  const qc = useQueryClient()
  const [chatMsgs, setChatMsgs] = React.useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = React.useState('')
  const [approvalRemark, setApprovalRemark] = React.useState('')
  const wsRef = React.useRef<WebSocket | null>(null)
  const chatEndRef = React.useRef<HTMLDivElement | null>(null)
  const saveQuesRef = React.useRef('')

  React.useEffect(() => {
    if (open && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs, open])

  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

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

  function closeChat() {
    onClose()
    setChatMsgs([])
    setChatInput('')
    setApprovalRemark('')
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  function sendChat() {
    if (!chatInput.trim() || !target) return
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
    if (!wsRef.current || !target) return
    wsRef.current.send(
      JSON.stringify({
        bot_id: target.agentId,
        user_id: '123456789',
        stream: true,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: ques, content_type: 'text' }],
      }),
    )
  }

  function submitApproval(type: 'pass' | 'reject') {
    if (!target) return
    if (!approvalRemark.trim()) {
      toast.error('请输入审核备注')
      return
    }
    approveMut.mutate({ id: target.id, type, remark: approvalRemark.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : closeChat())}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>审批 - {target?.agentName || target?.agentId}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 h-[450px]">
          <div className="flex flex-col border rounded-lg">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMsgs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground mt-10">输入消息开始对话</p>
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
                <span>{target?.agentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">开始时间</span>
                <span>{target?.startTime || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">联系电话</span>
                <span>{target?.startPhone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">描述</span>
                <span className="max-w-[150px] truncate">{target?.desc || '-'}</span>
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
  )
}
