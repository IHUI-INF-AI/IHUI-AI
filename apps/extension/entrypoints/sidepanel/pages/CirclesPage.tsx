/**
 * CirclesPage — 圈子列表(2026-07-25 立)。
 *
 * 数据源:getCircles() → GET /circles(分页 PageData<Circle>)。
 * 列表项:图标 + 圈子名 + 简介 + 成员数 + 帖子数,点击 chrome.tabs.create 跳 web 详情。
 */
import { useEffect, useState } from 'react'
import { getCircles, type Circle } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

function fmtCount(n: number | undefined): string {
  if (typeof n !== 'number') return '0'
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : String(n)
}

export default function CirclesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCircles({ page: 1, pageSize: 20 })
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
    void chrome.tabs.create({ url: `${WEB_BASE}/circles/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.circles')}</h3>
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
            <CardContent className="p-3 flex items-start gap-2.5">
              {c.coverImage ? (
                <img
                  src={c.coverImage}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted shrink-0 flex items-center justify-center text-base">
                  💬
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                {c.description ? (
                  <p className="m-0 mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {c.description}
                  </p>
                ) : null}
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{fmtCount(c.memberCount)} 成员</span>
                  <span>{fmtCount(c.postCount)} 帖子</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
