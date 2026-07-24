/**
 * NewsPage — 内容中心 / 资讯列表(2026-07-25 立)。
 *
 * 数据源:getNews() → GET /api/news/articles(分页 PageData<News>)。
 * 列表项:标题 + 摘要 + 时间 + 来源,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { getNews, type News } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(s))
  } catch {
    return ''
  }
}

export default function NewsPage() {
  const { t } = useI18n()
  const [news, setNews] = useState<News[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getNews({ page: 1, pageSize: 20 })
      if (res.success) setNews(res.data.list)
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
    void chrome.tabs.create({ url: `${WEB_BASE}/news/${encodeURIComponent(id)}` })
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">{t('common.loading')}</div>
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.news')}</h3>
      </div>
      {news.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {news.map((n) => (
            <Card
              key={n.id}
              className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openInWeb(n.id)}
            >
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm leading-snug line-clamp-2">{n.title}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 -mt-1">
                {n.summary ? (
                  <p className="m-0 text-xs text-muted-foreground line-clamp-2">{n.summary}</p>
                ) : null}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <span className="truncate">
                    {[n.authorName, n.categoryName].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span className="whitespace-nowrap">{fmtDate(n.publishedAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
