import { useEffect, useState } from 'react'
import { getFavorites, type FavoriteItem } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function FavoritesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getFavorites({ page: 1, pageSize: 30 })
      if (res.success) setItems(res.data.list)
      else setError(res.error || t('common.failed'))
    } catch {
      setError(t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs">
        <div className="mb-2">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-2 py-1 rounded-md border border-destructive bg-transparent text-destructive text-xs cursor-pointer hover:bg-destructive/10"
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
          <Card key={f.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-3 flex items-center gap-2.5">
              {f.cover ? (
                <img
                  src={f.cover}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted shrink-0 flex items-center justify-center text-base">
                  ⭐
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{f.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {new Intl.DateTimeFormat('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(f.createdAt))}
                </div>
              </div>
              {f.targetType ? (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                  {f.targetType}
                </span>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
