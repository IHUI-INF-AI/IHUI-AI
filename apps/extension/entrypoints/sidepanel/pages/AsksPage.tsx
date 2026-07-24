/**
 * AsksPage — 问答列表(2026-07-25 立)。
 *
 * 数据源:getAsks() → GET /asks(分页 PageData<Ask>)。
 * 列表项:问题标题 + 提问者 + 回答数 + 浏览数 + 时间,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { getAsks, type Ask } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-react'
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

function fmtCount(n: number | undefined): string {
  if (typeof n !== 'number') return '0'
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n)
}

export default function AsksPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<Ask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAsks({ page: 1, pageSize: 20 })
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
    void chrome.tabs.create({ url: `${WEB_BASE}/asks/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.asks')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((a) => (
          <Card
            key={a.id}
            className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => openInWeb(a.id)}
          >
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm leading-snug line-clamp-2">{a.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 -mt-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                <span className="flex items-center gap-1.5 truncate">
                  {a.isResolved ? <Badge variant="secondary">已解决</Badge> : null}
                  <span className="truncate">{a.author?.nickname || '—'}</span>
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span>{fmtCount(a.answerCount)} 回答</span>
                  <span>{fmtCount(a.viewCount)} 浏览</span>
                  <span>{fmtDate(a.createdAt)}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
