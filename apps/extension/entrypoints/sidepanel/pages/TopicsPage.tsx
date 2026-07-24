/**
 * TopicsPage — 话题列表(2026-07-25 立)。
 *
 * 数据源:getTopics() → GET /topics(分页 PageData<Topic>)。
 * 列表项:话题名 + 描述 + 讨论数 + 关注数,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { getTopics, type Topic } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

function fmtCount(n: number | undefined): string {
  if (typeof n !== 'number') return '0'
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n)
}

export default function TopicsPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getTopics({ page: 1, pageSize: 20 })
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
    void chrome.tabs.create({ url: `${WEB_BASE}/topics/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.topics')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((tp) => (
          <Card
            key={tp.id}
            className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => openInWeb(tp.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5">
                <span className="text-primary text-sm">#</span>
                <span className="font-medium text-sm truncate">{tp.name}</span>
              </div>
              {tp.description ? (
                <p className="m-0 mt-1 text-xs text-muted-foreground line-clamp-2">
                  {tp.description}
                </p>
              ) : null}
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{fmtCount(tp.postCount)} 讨论</span>
                <span>{fmtCount(tp.followerCount)} 关注</span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
