'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Star, Send } from 'lucide-react'

import {
  Button,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui'
import { cn } from '@/lib/utils'
import { api, STATUS_LABEL, STATUS_BADGE, PRIORITY_LABEL, textareaClass } from './helpers'
import type { Ticket, Comment, Rating } from './types'

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
            <span
              className={cn(
                'ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                STATUS_BADGE[ticket.status],
              )}
            >
              {STATUS_LABEL[ticket.status]}
            </span>
            <span className="ml-2">优先级：{PRIORITY_LABEL[ticket.priority]}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground">问题描述</div>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">沟通记录</div>
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
                      <span className="font-medium">{c.isAdmin ? '客服' : '我'}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              <Button
                size="sm"
                disabled={!reply.trim() || replyMut.isPending}
                onClick={() => {
                  setErr(null)
                  replyMut.mutate()
                }}
              >
                {replyMut.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                发送
              </Button>
            </div>
          </div>

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
                    className={cn(
                      'h-4 w-4',
                      n <= existingRating.rating
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-muted-foreground/40',
                    )}
                  />
                ))}
              </div>
              {existingRating.comment && (
                <p className="mt-1 text-sm text-muted-foreground">{existingRating.comment}</p>
              )}
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
                      className={cn(
                        'h-6 w-6 transition-colors',
                        n <= rating
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-muted-foreground/40 hover:text-amber-400',
                      )}
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
                <Button
                  size="sm"
                  disabled={ratingMut.isPending}
                  onClick={() => {
                    setErr(null)
                    ratingMut.mutate()
                  }}
                >
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
