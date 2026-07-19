'use client'
import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { LifeBuoy, ChevronLeft, ChevronRight, Send, Reply } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui'
import { Skeleton } from '@/components/ui/skeleton'
import { useZodForm } from '@/hooks/use-zod-form'
import type { Ticket, TicketListData, TicketStatus, TicketReplyBody } from './types'

const PAGE_SIZE = 15
const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  processing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  closed: 'bg-muted text-muted-foreground',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}
const STATUS_LABEL: Record<TicketStatus, string> = { open: '待处理', processing: '处理中', closed: '已关闭', resolved: '已解决' }

const replySchema = z.object({
  content: z.string().min(1, 'required').max(2000, 'maxLength'),
})
type ReplyForm = z.infer<typeof replySchema>

export default function AdminTicketPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<'' | TicketStatus>('')
  const [reply, setReply] = React.useState<{ id: string; content: string } | null>(null)

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
  if (status) qs.set('status', status)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ticket', qs.toString()],
    queryFn: async () => {
      const r = await fetchApi<TicketListData>(`/api/v1/admin/support/tickets?${qs}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const statusMut = useMutation({
    mutationFn: ({ id, s }: { id: string; s: TicketStatus }) =>
      fetchApi(`/api/v1/admin/support/tickets/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: s }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'ticket'] }); toast.success('状态已更新') },
    onError: (e: Error) => toast.error(e.message),
  })
  const replyMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TicketReplyBody }) =>
      fetchApi(`/api/v1/admin/support/tickets/${id}/reply`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { setReply(null); qc.invalidateQueries({ queryKey: ['admin', 'ticket'] }); toast.success('已回复') },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><LifeBuoy className="h-6 w-6 text-primary" />客服工单</h1>
        <select value={status} onChange={(e) => { setStatus(e.target.value as '' | TicketStatus); setPage(1) }}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="">全部状态</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">工单号</th><th className="px-4 py-2.5 font-medium">标题</th><th className="px-4 py-2.5 font-medium">提交人</th><th className="px-4 py-2.5 font-medium">状态</th><th className="px-4 py-2.5 font-medium">更新时间</th><th className="px-4 py-2.5 text-right font-medium">操作</th></tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-b border-border last:border-0">
                  <td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                </tr>
              ))
              : list.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">暂无工单</td></tr>
              : list.map((t: Ticket) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{t.ticketNo}</td>
                  <td className="px-4 py-2.5 font-medium line-clamp-1">{t.title}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.userName ?? t.userId}</td>
                  <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.updatedAt ? dtf.format(new Date(t.updatedAt)) : '-'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {t.status !== 'closed' && t.status !== 'resolved' && (
                        <Button size="sm" variant="ghost" disabled={statusMut.isPending}
                          onClick={() => statusMut.mutate({ id: t.id, s: t.status === 'open' ? 'processing' : 'resolved' })}>
                          {t.status === 'open' ? '受理' : '解决'}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setReply({ id: t.id, content: '' })}><Reply className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {reply && (
        <ReplyForm
          pending={replyMut.isPending}
          onSubmit={(content) => replyMut.mutate({ id: reply.id, body: { content, isAdmin: true } })}
          onCancel={() => setReply(null)}
        />
      )}
    </div>
  )
}

function ReplyForm({
  pending,
  onSubmit,
  onCancel,
}: {
  pending: boolean
  onSubmit: (content: string) => void
  onCancel: () => void
}) {
  const { form } = useZodForm<{ content: string }>({
    schema: replySchema,
    defaultValues: { content: '' },
  })
  const content = form.watch('content')
  const err = form.formState.errors.content?.message
  return (
    <form onSubmit={form.handleSubmit((v) => onSubmit(v.content))} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <Input {...form.register('content')} placeholder="输入回复内容" className="flex-1" aria-invalid={!!err} />
        <Button type="submit" size="sm" disabled={!content?.trim() || pending}><Send className="h-4 w-4" />发送</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>取消</Button>
      </div>
      {err && <p className="text-xs text-destructive">{(form.formState.errors.content?.message as string) ?? ''}</p>}
    </form>
  )
}
