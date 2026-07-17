'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useChatWs, AGENT_INFO, textareaClass, api } from './helpers'
import type { DemandRow, ChatMsg } from './types'

interface DemandAuditApprovalDialogProps {
  open: boolean
  row: DemandRow | null
  onClose: () => void
}

export function DemandAuditApprovalDialog({ open, row, onClose }: DemandAuditApprovalDialogProps) {
  const t = useTranslations('admin.demandAudit')
  const qc = useQueryClient()
  const [chatMsgs, setChatMsgs] = React.useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = React.useState('')
  const [remark, setRemark] = React.useState('')
  const sendingRef = React.useRef('')
  const { send, isConnected, lastMessage } = useChatWs()

  React.useEffect(() => {
    if (open) {
      setRemark('')
      setChatMsgs([])
    }
  }, [open])

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

  const approveMut = useMutation({
    mutationFn: (action: 'pass' | 'reject') =>
      api(action === 'pass' ? '/api/admin/examine/pass' : '/api/admin/examine/reject', {
        method: 'POST',
        body: JSON.stringify(
          action === 'pass' ? { recordId: row?.id } : { recordId: row?.id, reason: remark },
        ),
      }),
    onSuccess: () => {
      toast.success(t('operateSuccess'))
      qc.invalidateQueries({ queryKey: ['admin', 'demand-audit'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function sendChat() {
    if (!chatInput.trim()) return
    sendingRef.current = chatInput
    setChatMsgs((prev) => [...prev, { ques: chatInput, content: '' }])
    send(
      JSON.stringify({
        bot_id: row?.agentId || '',
        user_id: '123456789',
        stream: true,
        auto_save_history: true,
        additional_messages: [{ role: 'user', content: chatInput, content_type: 'text' }],
      }),
    )
    setChatInput('')
  }

  const agentInfo = row?.agentCategory ?? {}

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('approvalTitle')}</DialogTitle>
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
              {isConnected ? t('wsConnected') : t('wsDisconnected')}
            </div>
            <div
              className="flex-1 space-y-2 overflow-y-auto rounded-md border p-2"
              style={{ minHeight: '200px', maxHeight: '300px' }}
            >
              {chatMsgs.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">{t('chatEmpty')}</p>
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
                placeholder={t('chatInputPlaceholder')}
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
              <Label className="text-xs">{t('opinionLabel')}</Label>
              <textarea
                className={textareaClass}
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={t('opinionPlaceholder')}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  disabled={approveMut.isPending}
                  onClick={() => approveMut.mutate('pass')}
                >
                  <Check className="h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={approveMut.isPending}
                  onClick={() => approveMut.mutate('reject')}
                >
                  <X className="h-4 w-4" />
                  {t('reject')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
