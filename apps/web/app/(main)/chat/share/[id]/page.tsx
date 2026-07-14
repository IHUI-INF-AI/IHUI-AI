'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Share2, Copy, User, Bot } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  createdAt: string
}

interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function ChatSharePage() {
  const params = useParams<{ id: string }>()
  const locale = useLocale()
  const [copied, setCopied] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'share', params.id],
    queryFn: () => api<ConversationDetail>(`/api/chat/conversations/${params.id}`),
    enabled: !!params.id,
  })

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmt = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/chat/share/${params.id}` : ''

  function copyLink() {
    if (!shareUrl) return
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true)
        toast.success('链接已复制')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('复制失败'))
  }

  const conversation = data?.conversation
  const messages = data?.messages ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Link
        href="/chat"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Share2 className="h-6 w-6 text-primary" />
            {conversation?.title ?? '分享对话'}
          </h1>
          {conversation && (
            <p className="mt-1 text-sm text-muted-foreground">{fmt(conversation.createdAt)}</p>
          )}
        </div>
        <Button size="sm" onClick={copyLink}>
          <Copy className="mr-1.5 h-4 w-4" />
          {copied ? '已复制' : '复制链接'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Share2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无对话内容</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user'
            const Icon = isUser ? User : Bot
            return (
              <Card key={msg.id}>
                <CardContent className="flex gap-3 p-4">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                      isUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{isUser ? '用户' : '助手'}</span>
                      <span>{fmt(msg.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
