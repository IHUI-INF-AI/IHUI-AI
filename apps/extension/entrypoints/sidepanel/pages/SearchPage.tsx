// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SearchPage — 内容中心 / 全站搜索(2026-07-25 立)。
 *
 * 数据源:searchContent() → GET /api/search(返回 SearchResult { items, total })。
 * 顶部 Input + 搜索按钮,回车或点击触发;结果列表展示 title + summary + type badge。
 * 点击结果项 chrome.tabs.create 跳 web(item.url 优先,否则跳 /search?q=)。
 */
import { useState, type FormEvent } from 'react'
import { searchContent, type SearchResult } from '@ihui/api-client'
import { Badge, Card, CardContent, CardHeader, CardTitle, SearchInput } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { openInWeb as openItemInWeb, openWebUrl } from '../../../lib/open-in-web'
import { enumLabel } from '../components/MessageContent'

type ItemType = 'lesson' | 'live' | 'article' | 'news' | 'ask' | 'resource' | 'exam'

// ItemType 是契约层闭集,七类全部登记;后端若新增取值,enumLabel 会原样显示而非回显键名
const TYPE_LABEL_KEY: Readonly<Record<ItemType, string>> = {
  lesson: 'content.typeLesson',
  live: 'content.typeLive',
  article: 'content.typeArticle',
  news: 'content.typeNews',
  ask: 'content.typeAsk',
  resource: 'content.typeResource',
  exam: 'content.typeExam',
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
    if (url) {
      openWebUrl(url)
      return
    }
    openItemInWeb(id ? `/search?q=${encodeURIComponent(submitted)}` : '/search')
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.search')}</h3>
      </div>
      <form onSubmit={onSubmit} className="flex gap-1.5">
        <SearchInput
          size="lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('apps.searchDesc')}
          wrapperClassName="min-w-0 flex-1"
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
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.loading')}
        </div>
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
                onClick={() => openItem(it.url)}
              >
                <CardHeader className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 whitespace-nowrap"
                    >
                      {enumLabel(it.type, TYPE_LABEL_KEY, t)}
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
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
