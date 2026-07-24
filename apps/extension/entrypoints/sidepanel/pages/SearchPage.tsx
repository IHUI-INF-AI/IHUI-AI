/**
 * SearchPage — 内容中心 / 全站搜索(2026-07-25 立)。
 *
 * 数据源:searchContent() → GET /api/search(返回 SearchResult { items, total })。
 * 顶部 Input + 搜索按钮,回车或点击触发;结果列表展示 title + summary + type badge。
 * 点击结果项 chrome.tabs.create 跳 web(item.url 优先,否则跳 /search?q=)。
 */
import { useState, type FormEvent } from 'react'
import { searchContent, type SearchResult } from '@ihui/api-client'
import { Badge, Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

type ItemType = 'lesson' | 'live' | 'article' | 'news' | 'ask' | 'resource' | 'exam'

const TYPE_LABEL_ZH: Record<ItemType, string> = {
  lesson: '课程',
  live: '直播',
  article: '文章',
  news: '资讯',
  ask: '问答',
  resource: '资源',
  exam: '试题',
}

export default function SearchPage() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doSearch = async (q: string) => {
    const kw = q.trim()
    if (!kw) return
    setLoading(true)
    setError('')
    setSubmitted(kw)
    try {
      const res = await searchContent({ q: kw, limit: 20 })
      if (res.success) setResult(res.data)
      else setError(res.error || t('common.failed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void doSearch(query)
  }

  const openItem = (url?: string, id?: string) => {
    const target = url || (id ? `${WEB_BASE}/search?q=${encodeURIComponent(submitted)}` : `${WEB_BASE}/search`)
    void chrome.tabs.create({ url: target })
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.search')}</h3>
      </div>
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('apps.searchDesc')}
          className="flex-1 text-sm"
          disabled={loading}
          aria-label={t('common.search')}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-3 py-2 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.search')}
        </button>
      </form>

      {loading ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">{t('common.loading')}</div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2">
          <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs text-center">
            {error}
          </div>
          <button
            type="button"
            onClick={() => void doSearch(submitted)}
            className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : submitted ? (
        result && result.items.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="text-[11px] text-muted-foreground">
              {t('common.all')}: {result.total}
            </div>
            {result.items.map((it) => (
              <Card
                key={`${it.type}-${it.id}`}
                className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openItem(it.url, it.id)}
              >
                <CardHeader className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                      {TYPE_LABEL_ZH[it.type as ItemType] || it.type}
                    </Badge>
                    <CardTitle className="text-sm leading-snug line-clamp-2 flex-1">
                      {it.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                {it.summary ? (
                  <CardContent className="px-3 pb-2 -mt-1">
                    <p className="m-0 text-xs text-muted-foreground line-clamp-2">{it.summary}</p>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8 px-4 text-sm">
            {t('common.empty')}
          </div>
        )
      ) : (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">{t('common.empty')}</div>
      )}
    </div>
  )
}
