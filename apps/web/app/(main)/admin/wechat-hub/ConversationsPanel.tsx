// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AudioLines, Loader2, MessageSquare, RefreshCw, Users } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { WechatMessageView } from '@ihui/types'
import { cn } from '@/lib/utils'
import ConversationExportButton from './ConversationExportButton'
import HistoryImportButton from './HistoryImportButton'
import HistorySyncButton from './HistorySyncButton'
import VoiceTranscribeButton from './VoiceTranscribeButton'
import { wechatHubApi } from './wechat-hub-api'

function formatTime(value: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function MessageBubble({
  message,
  accountId,
  readOnly,
}: {
  message: WechatMessageView
  accountId: string
  readOnly?: boolean
}) {
  const qc = useQueryClient()
  const [voiceNote, setVoiceNote] = React.useState<{
    level: 'info' | 'warning' | 'error'
    text: string
  } | null>(null)

  const transcribeMutation = useMutation({
    mutationFn: () => wechatHubApi.transcribeVoice(accountId, { messageId: message.id }),
    onSuccess: (result) => {
      // 单条入口只回单条结构；兜底遇到批量结构时不展示任何占位文本，交给列表刷新。
      if (!('items' in result)) {
        if (result.stub) {
          setVoiceNote({
            level: 'warning',
            text: '转写引擎暂不可用（本地模型未就绪），未写入检索库',
          })
        } else {
          setVoiceNote({ level: 'info', text: '转写完成' })
        }
      } else {
        setVoiceNote(null)
      }
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
    },
    onError: (error) => {
      setVoiceNote({
        level: 'error',
        text: error instanceof Error ? error.message : '语音转写失败',
      })
      void qc.invalidateQueries({ queryKey: ['wechat-hub', 'messages', accountId] })
    },
  })

  const outbound = message.direction === 'outbound'
  return (
    <div className={cn('flex w-full', outbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          outbound ? 'bg-cta text-cta-foreground' : 'bg-muted text-foreground',
        )}
      >
        <p className="mb-1 text-xs opacity-80">
          {outbound ? '我' : (message.senderName ?? message.senderId ?? '未知')} ·{' '}
          {formatTime(message.sentAt)}
          {message.kind !== 'text' ? ` · ${message.kind}` : ''}
        </p>
        <p className="whitespace-pre-wrap break-words">{message.content || '(空消息)'}</p>
        {message.mediaUrl ? (
          <a
            className="mt-1 block break-all text-xs underline opacity-80"
            href={message.mediaUrl}
            target="_blank"
            rel="noreferrer"
          >
            {message.mediaUrl}
          </a>
        ) : null}
        {message.kind === 'voice' && !readOnly ? (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => transcribeMutation.mutate()}
              disabled={transcribeMutation.isPending}
            >
              {transcribeMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <AudioLines className="mr-1 h-3 w-3" />
              )}
              转写
            </Button>
            {voiceNote ? (
              <span
                className={cn(
                  'text-xs',
                  voiceNote.level === 'warning' && 'text-amber-600 dark:text-amber-500',
                  voiceNote.level === 'error' && 'text-red-600 dark:text-red-500',
                  voiceNote.level === 'info' && 'opacity-80',
                )}
              >
                {voiceNote.text}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ConversationsPanel({
  accountId,
  readOnly,
}: {
  accountId: string
  readOnly?: boolean
}) {
  const [conversationId, setConversationId] = React.useState<string | null>(null)
  const [switchNotice, setSwitchNotice] = React.useState<string | null>(null)

  const conversationsQuery = useQuery({
    queryKey: ['wechat-hub', 'conversations', accountId],
    queryFn: () => wechatHubApi.conversations(accountId, 100),
    refetchInterval: 15_000,
  })
  const messagesQuery = useQuery({
    queryKey: ['wechat-hub', 'messages', accountId, conversationId],
    queryFn: () => wechatHubApi.messages(accountId, conversationId, 200),
    refetchInterval: 10_000,
  })

  const switchMutation = useMutation({
    mutationFn: (title: string) => wechatHubApi.switchChat(accountId, title),
    onSuccess: (result, title) => {
      setSwitchNotice(
        result.ok ? `已切换到「${title}」` : result.reason || '切换失败，请确认微信窗口可见',
      )
      setTimeout(() => setSwitchNotice(null), 4000)
    },
    onError: (error) => {
      setSwitchNotice(error instanceof Error ? error.message : '切换会话失败')
      setTimeout(() => setSwitchNotice(null), 4000)
    },
  })

  React.useEffect(() => {
    setConversationId(null)
  }, [accountId])

  const conversations = conversationsQuery.data ?? []
  const messages = messagesQuery.data ?? []
  const selected = conversations.find((item) => item.id === conversationId)

  return (
    <div className="grid grid-cols-1 gap-3 min-[1000px]:grid-cols-[320px_1fr]">
      <Card>
        <CardContent className="space-y-2 p-3 min-[640px]:p-3">
          <div className="flex items-center justify-between">
            <p className="text-body font-semibold">会话</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void conversationsQuery.refetch()}
              disabled={conversationsQuery.isFetching}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', conversationsQuery.isFetching && 'animate-spin')}
              />
            </Button>
          </div>
          <Button
            size="sm"
            variant={conversationId === null ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setConversationId(null)}
          >
            全部消息
          </Button>
          {conversationsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载会话…
            </div>
          ) : conversations.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              暂无会话。收到第一条消息后会自动归并到这里。
            </p>
          ) : (
            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {conversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setConversationId(item.id)}
                  className={cn(
                    'w-full rounded-md px-2 py-2 text-left transition-colors',
                    conversationId === item.id ? 'bg-muted text-foreground' : 'hover:bg-muted/60',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {item.kind === 'group' ? (
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate">{item.title || item.platformChatId}</span>
                    {item.unreadCount > 0 ? (
                      <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.kind} · {formatTime(item.lastMessageAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-3 min-[640px]:p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-body font-semibold">{selected?.title || '全部消息'}</p>
              <p className="text-xs text-muted-foreground">
                {selected ? selected.platformChatId : '最近 200 条'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <HistorySyncButton accountId={accountId} />
              <HistoryImportButton accountId={accountId} />
              {readOnly ? null : <VoiceTranscribeButton accountId={accountId} />}
              <ConversationExportButton accountId={accountId} conversationId={conversationId} />
              {readOnly && selected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => switchMutation.mutate(selected.title || selected.platformChatId)}
                  disabled={switchMutation.isPending}
                >
                  {switchMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  切到微信
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void messagesQuery.refetch()}
                disabled={messagesQuery.isFetching}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', messagesQuery.isFetching && 'animate-spin')}
                />
              </Button>
            </div>
          </div>
          {switchNotice ? <p className="text-xs text-muted-foreground">{switchNotice}</p> : null}
          {messagesQuery.isError ? (
            <Alert
              variant="danger"
              title="读取消息失败"
              description={
                messagesQuery.error instanceof Error ? messagesQuery.error.message : '未知错误'
              }
            />
          ) : messagesQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载消息…
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无消息。iLink 只收私聊；群聊请使用本地桥后端。
            </p>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  accountId={accountId}
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
