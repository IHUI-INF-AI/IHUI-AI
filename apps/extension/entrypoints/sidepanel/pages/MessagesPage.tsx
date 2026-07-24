/**
 * MessagesPage — 个人中心 / 私信消息列表(2026-07-25 立)。
 *
 * 数据源:GET /api/messages(分页 PageData<MessageItem>)。
 * 列表项:头像(initials)+ 昵称 + 消息摘要 + 时间 + 未读角标。
 * 顶部"全部已读"按钮(markAllMessagesRead),点击项 chrome.tabs.create 跳 web 详情。
 *
 * 注:chat.ts 也有同名 getMessages(签名不同),index.ts 显式 re-export 自 chat.ts,
 * 故此处用 fetchApi 直接调 /api/messages 绕过命名冲突,确保拿到 notification.ts 的语义。
 */
import { useEffect, useState } from 'react'
import {
  fetchApi,
  markAllMessagesRead,
  type MessageItem,
  type PageData,
} from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

function fmtTime(s: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(s))
  } catch {
    return ''
  }
}

function initials(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || '?'
}

export default function MessagesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<MessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<PageData<MessageItem>>('/api/messages', {
        params: { page: 1, pageSize: 30 },
      })
      if (res.success) setItems(res.data.list)
      else setError(res.error || t('common.failed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unreadCount = items.filter((m) => !m.isRead).length

  const onMarkAll = async () => {
    const res = await markAllMessagesRead()
    if (res.success) {
      setItems((prev) => prev.map((m) => ({ ...m, isRead: true })))
    }
  }

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/messages/${encodeURIComponent(id)}` })
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 flex flex-col items-center gap-2">
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs text-center">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.messages')}</h3>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={onMarkAll}
            className="text-xs text-primary bg-transparent border-none cursor-pointer hover:underline py-1 px-1"
          >
            {t('notification.markAllRead')}({unreadCount})
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((m) => (
          <Card
            key={m.id}
            className={`rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors ${m.isRead ? '' : 'border-primary/40'}`}
            onClick={() => openInWeb(m.id)}
          >
            <CardContent className="p-3 flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-md bg-muted shrink-0 flex items-center justify-center text-sm font-medium text-muted-foreground">
                {initials(m.fromNickname)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{m.fromNickname}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {fmtTime(m.createdAt)}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-xs text-muted-foreground line-clamp-2">{m.content}</p>
              </div>
              {!m.isRead ? (
                <span
                  className="w-1.5 h-1.5 rounded-md bg-destructive shrink-0 mt-1.5"
                  aria-label="unread"
                />
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
