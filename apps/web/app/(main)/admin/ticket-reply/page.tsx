'use client'
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import type { TicketReply, TicketReplyListData } from './types'

export default function AdminTicketReplyPage() {
  const locale = useLocale()
  const sp = useSearchParams()
  const ticketId = sp.get('ticketId') ?? ''
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ticket-reply', ticketId],
    queryFn: async () => {
      const r = await fetchApi<TicketReplyListData>(`/api/v1/admin/support/tickets/${ticketId}/replies`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    enabled: !!ticketId,
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><MessageSquare className="h-6 w-6 text-primary" />工单回复</h1>
      <p className="text-sm text-muted-foreground">工单 ID:{ticketId || '—'} · 共 {total} 条回复</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">回复人</th><th className="px-4 py-2.5 font-medium">身份</th><th className="px-4 py-2.5 font-medium">内容</th><th className="px-4 py-2.5 font-medium">时间</th></tr>
          </thead>
          <tbody>
            {!ticketId ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">请通过工单页面进入查看回复</td></tr>
              : isLoading ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />加载中...</td></tr>
              : list.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">暂无回复</td></tr>
              : list.map((r: TicketReply) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{r.userName ?? r.userId}</td>
                  <td className="px-4 py-2.5"><span className={`rounded px-2 py-0.5 text-xs ${r.isAdmin ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{r.isAdmin ? '客服' : '用户'}</span></td>
                  <td className="px-4 py-2.5 max-w-xl whitespace-pre-wrap">{r.content}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.createdAt ? dtf.format(new Date(r.createdAt)) : '-'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
