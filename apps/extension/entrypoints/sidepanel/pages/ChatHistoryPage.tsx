/**
 * ChatHistoryPage — 历史对话列表(2026-07-25 立)。
 *
 * 数据源:GET /api/chat/conversations(分页 PageData<ConversationSummary>)。
 * 列表项:对话标题 + 最后消息 + 更新时间 + 消息数,每项有删除按钮(deleteConversation)。
 * 点击跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { fetchApi, deleteConversation, type PageData } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

interface ConversationSummary {
  id: string
  title: string
  lastMessage?: string | null
  lastMessageAt?: string | null
  updatedAt?: string | null
  messageCount?: number
}

function fmtTime(s?: string | null): string {
  if (!s) return ''
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

export default function ChatHistoryPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<PageData<ConversationSummary>>('/api/chat/conversations', {
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

  const onDelete = async (id: string) => {
    const res = await deleteConversation(id)
    if (res.success) {
      setItems((prev) => prev.filter((c) => c.id !== id))
    }
  }

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/chat/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('chat.history')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((c) => (
          <Card
            key={c.id}
            className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => openInWeb(c.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm flex-1 min-w-0 truncate">{c.title || '—'}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void onDelete(c.id)
                  }}
                  className="shrink-0 px-2 py-1 text-[11px] rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
              {c.lastMessage ? (
                <p className="m-0 mt-1 text-xs text-muted-foreground line-clamp-1">{c.lastMessage}</p>
              ) : null}
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="whitespace-nowrap">{fmtTime(c.lastMessageAt || c.updatedAt)}</span>
                {typeof c.messageCount === 'number' ? (
                  <span className="tabular-nums">{c.messageCount} 条</span>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
