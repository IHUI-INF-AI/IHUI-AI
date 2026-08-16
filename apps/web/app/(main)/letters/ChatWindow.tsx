'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input } from '@ihui/ui-react'
import { Alert, ConfirmDialog, Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { formatLetterTime } from './helpers'
import type { LetterListData, PrivateLetter } from './types'

interface ChatWindowProps {
  /** 聊天对象 userId */
  memberId: string
  /** 聊天对象昵称 */
  memberName: string
}

export function ChatWindow({ memberId, memberName }: ChatWindowProps) {
  const t = useTranslations('eduAi.letters')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()

  const [draft, setDraft] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sendError, setSendError] = React.useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<PrivateLetter | null>(null)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const queryKey = ['private-letters', 'list', memberId] as const

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: '50',
        senderId: memberId,
        id: '0',
      })
      const r = await fetchApi<LetterListData>(`/api/private-letters/list?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })

  // 后端按 id 降序（最新在前），渲染时按 id 升序展示
  const messages = React.useMemo<PrivateLetter[]>(() => {
    const list = data?.list ?? []
    return [...list].sort((a, b) => a.id - b.id)
  }, [data])

  const currentUserId = data?.currentUserId ?? ''

  // 消息变化或切换会话后滚动到底部
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, memberId])

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setSendError(null)
    try {
      const r = await fetchApi<PrivateLetter>('/api/private-letters', {
        method: 'POST',
        body: JSON.stringify({ receiverId: memberId, content }),
      })
      if (!r.success) throw new Error(r.error)
      setDraft('')
      await queryClient.invalidateQueries({ queryKey: ['private-letters', 'list', memberId] })
      await queryClient.invalidateQueries({ queryKey: ['private-letters', 'members'] })
    } catch (e) {
      setSendError(e instanceof Error ? e.message : t('error'))
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeletingId(target.id)
    try {
      const r = await fetchApi<{ id: number; deleted: boolean }>('/api/private-letters', {
        method: 'DELETE',
        body: JSON.stringify({ id: target.id }),
      })
      if (!r.success) throw new Error(r.error)
      // 本地移除该条消息，同时刷新会话列表摘要
      queryClient.setQueryData<LetterListData>(queryKey, (old) => {
        if (!old) return old
        return { ...old, list: old.list.filter((m) => m.id !== target.id) }
      })
      await queryClient.invalidateQueries({ queryKey: ['private-letters', 'members'] })
      setDeleteTarget(null)
    } catch (e) {
      setSendError(e instanceof Error ? e.message : t('error'))
      setDeleteTarget(null)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 会话标题栏 */}
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground">
          {(memberName || '?').slice(0, 1)}
        </div>
        <p className="truncate text-sm font-medium">{memberName}</p>
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : isError ? (
          <Alert variant="danger" description={(error as Error).message} />
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId
            const isDeleting = deletingId === msg.id
            const deleteBtn = (
              <Tooltip content={t('delete')}>
                <button
                  type="button"
                  aria-label={t('delete')}
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(msg)}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </Tooltip>
            )
            return (
              <div
                key={msg.id}
                className={cn(
                  'group flex items-end gap-1.5',
                  isMine ? 'justify-end' : 'justify-start',
                )}
              >
                {isMine && deleteBtn}
                <div
                  className={cn(
                    'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
                    isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={cn(
                      'mt-1 whitespace-nowrap text-right text-xs tabular-nums',
                      isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {isMine ? `${t('you')} · ` : ''}
                    {formatLetterTime(msg.createdAt)}
                  </p>
                </div>
                {!isMine && deleteBtn}
              </div>
            )
          })
        )}
      </div>

      {/* 发送区 */}
      <div className="border-t p-3">
        {sendError && (
          <Alert
            variant="danger"
            description={sendError}
            className="mb-2"
            closable
            onClose={() => setSendError(null)}
          />
        )}
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={t('sendPlaceholder')}
            disabled={sending}
            maxLength={1000}
            className="h-9"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('send')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('delete')}
        content={t('deleteConfirm')}
        confirmText={tc('confirm')}
        cancelText={tc('cancel')}
        variant="danger"
        loading={deletingId !== null}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
