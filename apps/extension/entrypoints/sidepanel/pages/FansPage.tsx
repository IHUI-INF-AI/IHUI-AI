/**
 * FansPage — 粉丝列表(2026-07-25 立)。
 *
 * 数据源:getFans() → GET /api/follows/followers(分页 PageData<FollowUser>)。
 * 列表项:头像(initials)+ 昵称 + 简介 + 关注时间 + "回粉"按钮(fetchApi POST /follows/:id)。
 */
import { useEffect, useState } from 'react'
import { getFans, fetchApi, type FollowUser } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly as fmtDate } from '../../../lib/date-utils'

const WEB_BASE = 'https://ihui.ai'

function initials(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || '?'
}

export default function FansPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getFans({ page: 1, pageSize: 30 })
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

  const onFollowBack = async (id: string) => {
    const res = await fetchApi<{ followed: boolean }>(`/follows/${encodeURIComponent(id)}`, {
      method: 'POST',
    })
    if (res.success) {
      setFollowingIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
    }
  }

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/users/${encodeURIComponent(id)}` })
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.fans')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((u) => {
          const followed = followingIds.has(u.id)
          return (
            <Card
              key={u.id}
              className="rounded-md border-border shadow-none hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => openInWeb(u.id)}
            >
              <CardContent className="p-3 flex items-center gap-2.5">
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt=""
                    className="w-9 h-9 rounded-md object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-md bg-muted shrink-0 flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {initials(u.nickname || u.username)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{u.nickname || u.username}</span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {fmtDate(u.followedAt)}
                    </span>
                  </div>
                  {u.bio ? (
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground line-clamp-1">{u.bio}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={followed}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!followed) void onFollowBack(u.id)
                  }}
                  className="shrink-0 px-2 py-1 text-[11px] rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  {followed ? '已回粉' : '回粉'}
                </button>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
