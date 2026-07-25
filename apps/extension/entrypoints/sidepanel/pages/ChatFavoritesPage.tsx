/**
 * ChatFavoritesPage — 收藏的对话列表(2026-07-25 立)。
 *
 * 数据源:GET /api/chat/favorites(分页 PageData<ChatFavorite>)。
 * 列表项:对话标题 + 收藏时间 + 摘要,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { fetchApi, type PageData } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly as fmtDate } from '../../../lib/date-utils'

const WEB_BASE = 'https://ihui.ai'

interface ChatFavorite {
  id: string
  title: string
  summary?: string | null
  createdAt?: string | null
}

export default function ChatFavoritesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<ChatFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<PageData<ChatFavorite>>('/api/chat/favorites', {
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

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/chat/favorites/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.favorites')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((f) => (
          <Card
            key={f.id}
            className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => openInWeb(f.id)}
          >
            <CardContent className="p-3">
              <div className="font-medium text-sm truncate">{f.title || '—'}</div>
              {f.summary ? (
                <p className="m-0 mt-1 text-xs text-muted-foreground line-clamp-2">{f.summary}</p>
              ) : null}
              <div className="mt-1.5 text-[11px] text-muted-foreground">{fmtDate(f.createdAt)}</div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
