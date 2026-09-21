// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, Share2, Copy, User, Bot } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallCard } from '@/components/ai/tool-call-card'
// P3 #39 阶段2(2026-09-16 立):执行轨迹回放
import { TraceReplay } from '@/components/ai/trace-replay'
import type { ToolCall } from '@/stores/chat'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** 推理过程:后端分享端点直接返回 chat_messages 原始行(含 reasoning),旧数据可能缺省 */
  reasoning?: string | null
  /** 工具调用:后端当前未持久化该字段(chat_messages 表无对应列),按存在性防御性渲染 */
  toolCalls?: ToolCall[]
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
  const t = useTranslations('aiChat')
  const [copied, setCopied] = React.useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['chat', 'share', params.id],
    queryFn: () => {
      // 判断是否为token模式（16位字母数字）
      const isToken = /^[a-zA-Z0-9]{16}$/.test(params.id)
      if (isToken) {
        return api<ConversationDetail>(`/api/chat/conversations/share/${params.id}`)
      }
      // 原有逻辑：需要登录
      return api<ConversationDetail>(`/api/chat/conversations/${params.id}/messages`)
    },
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
        toast.success(t('shareCopied'))
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error(t('copyFailed')))
  }

  const conversation = data?.conversation
  const messages = data?.messages ?? []

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
      <Link
        href="/chat"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Share2 className="h-6 w-6 text-primary" />
            {conversation?.title ?? t('shareConversation')}
          </h1>
          {conversation && (
            <p className="mt-1 text-sm text-muted-foreground">{fmt(conversation.createdAt)}</p>
          )}
        </div>
        <Button size="sm" onClick={copyLink}>
          <Copy className="mr-1.5 h-4 w-4" />
          {copied ? t('copied') : t('copyLink')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center text-muted-foreground">
          <Share2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">{t('noContent')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg: Message) => {
            const isUser = msg.role === 'user'
            const Icon = isUser ? User : Bot
            return (
              <Card key={msg.id}>
                <CardContent className="min-[640px]:p-3 flex gap-3 p-3">
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
                      <span className="font-medium">{isUser ? t('user') : t('assistant')}</span>
                      <span>{fmt(msg.createdAt)}</span>
                    </div>
                    {/* 只读分享:assistant 消息复用对话内的推理/工具卡组件展示,不传任何可变操作回调 */}
                    {!isUser && msg.reasoning ? (
                      <ThinkingSection
                        content={msg.reasoning}
                        currentNode={null}
                        isStreaming={false}
                      />
                    ) : null}
                    {!isUser &&
                      msg.toolCalls?.map((tc) => (
                        <ToolCallCard
                          key={tc.id}
                          toolName={tc.toolName}
                          args={tc.args}
                          result={tc.result}
                          status={tc.status}
                          duration={tc.duration ?? tc.durationMs}
                          error={tc.error}
                          iteration={tc.iteration}
                        />
                      ))}
                    {/* P3 #39 阶段2(2026-09-16 立):执行轨迹回放(>=2 步时时序重演,与静态工具卡互补) */}
                    {!isUser && msg.toolCalls && msg.toolCalls.length >= 2 && (
                      <TraceReplay toolCalls={msg.toolCalls} />
                    )}
                    <MarkdownStream content={msg.content} isStreaming={false} />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
