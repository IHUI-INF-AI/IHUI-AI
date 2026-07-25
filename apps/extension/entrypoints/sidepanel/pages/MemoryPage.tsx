/**
 * MemoryPage — 记忆系统(2026-07-25 立)。
 * 数据源:fetchApi('/memory') → GET /api/memory(api-client 未封装,直接调用)。
 * 列表项:标题 + 摘要 + 时间 + 类型标签,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDate } from '../../../lib/date-utils'

const WEB_BASE = 'https://ihui.ai'

interface MemoryItem {
  id: string
  title?: string
  summary?: string
  content?: string
  type?: string
  category?: string
  createdAt?: string
  updatedAt?: string
}

export default function MemoryPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<MemoryItem[]>('/memory', { params: { page: 1, pageSize: 30 } })
      if (res.success) setItems(res.data)
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
    void chrome.tabs.create({ url: `${WEB_BASE}/memory/${encodeURIComponent(id)}` })
  }

  const openNew = () => {
    void chrome.tabs.create({ url: `${WEB_BASE}/memory/new` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.memory')}</h3>
        <button
          type="button"
          onClick={openNew}
          className="px-2 py-1 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          + {t('apps.memory')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((m) => (
            <Card
              key={m.id}
              className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openInWeb(m.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openInWeb(m.id)
                }
              }}
            >
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm leading-snug line-clamp-2">
                  {m.title || '—'}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 -mt-1">
                {m.summary ? (
                  <p className="m-0 text-xs text-muted-foreground line-clamp-2">{m.summary}</p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <span className="truncate">{m.type || m.category || '—'}</span>
                  <span className="whitespace-nowrap">{fmtDate(m.createdAt || m.updatedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
