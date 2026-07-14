'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { MessageSquare, Loader2, Send } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'

type FeedbackType = 'bug' | 'suggestion' | 'question' | 'other'

interface FeedbackItem {
  id: string
  type: FeedbackType
  title: string
  content: string
  status: 'pending' | 'resolved' | 'closed'
  createdAt: string
  reply?: string | null
}

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: '问题反馈',
  suggestion: '功能建议',
  question: '使用咨询',
  other: '其他',
}

const STATUS_CLS: Record<FeedbackItem['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  resolved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  closed: 'bg-muted text-muted-foreground',
}

const STATUS_LABEL: Record<FeedbackItem['status'], string> = {
  pending: '处理中',
  resolved: '已回复',
  closed: '已关闭',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function MemberFeedbackPage() {
  const locale = useLocale()
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'list' | 'new'>('list')
  const [type, setType] = React.useState<FeedbackType>('bug')
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [contact, setContact] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['member', 'feedback'],
    queryFn: () =>
      api<{ list: FeedbackItem[] }>('/api/feedbacks')
        .then((d) => d.list ?? [])
        .catch(() => [] as FeedbackItem[]),
  })

  const createMut = useMutation({
    mutationFn: (input: { type: FeedbackType; title: string; content: string; contact?: string }) =>
      api<{ feedback: FeedbackItem }>('/api/feedbacks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', 'feedback'] })
      setTab('list')
      setType('bug')
      setTitle('')
      setContent('')
      setContact('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    createMut.mutate({
      type,
      title: title.trim(),
      content: content.trim(),
      contact: contact.trim() || undefined,
    })
  }

  const items = data ?? []
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <MessageSquare className="h-5 w-5 text-primary" />
          意见反馈
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">提交反馈,帮助我们做得更好</p>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        {(['list', 'new'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              tab === v
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v === 'list' ? '历史记录' : '提交反馈'}
          </button>
        ))}
      </div>

      {error && <Alert variant="danger" description={(error as Error).message} />}

      {tab === 'list' ? (
        isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">暂无反馈记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="transition-colors hover:bg-accent">
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {TYPE_LABEL[item.type] ?? item.type}
                      </span>
                      <span className="text-sm font-medium">{item.title}</span>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        STATUS_CLS[item.status],
                      )}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.content}</p>
                  {item.reply && (
                    <p className="rounded bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                      回复:{item.reply}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(item.createdAt))}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">类型</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as FeedbackType)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">标题</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="请简短描述问题"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">内容</Label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请详细描述..."
                  required
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">联系方式(选填)</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="便于我们与你联系"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createMut.isPending}>
                  {createMut.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  提交
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setTab('list')}>
                  取消
                </Button>
              </div>
              {createMut.isError && (
                <Alert variant="danger" description={(createMut.error as Error).message} />
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
