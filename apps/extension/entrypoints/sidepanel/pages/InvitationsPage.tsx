/**
 * InvitationsPage — 邀请记录(2026-07-25 立)。
 *
 * 数据源:getOverview() (统计)+ getInvitedUsers()(列表)(distribution.ts)。
 * 顶部:邀请统计(总邀请数/活跃数);下方:被邀请人列表(头像/昵称/注册时间/状态/贡献佣金)。
 */
import { useEffect, useState } from 'react'
import {
  getOverview,
  getInvitedUsers,
  type CommissionOverview,
  type InvitedUser,
} from '@ihui/api-client'
import { Card, CardContent, Badge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly as fmtDate } from '../../../lib/date-utils'

function initials(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || '?'
}

function fmtMoney(n: number | undefined): string {
  if (typeof n !== 'number') return '0.00'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function InvitationsPage() {
  const { t } = useI18n()
  const [overview, setOverview] = useState<CommissionOverview | null>(null)
  const [items, setItems] = useState<InvitedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [ovRes, listRes] = await Promise.all([
        getOverview(),
        getInvitedUsers({ page: 1, pageSize: 30 }),
      ])
      if (ovRes.success) setOverview(ovRes.data)
      if (listRes.success) setItems(listRes.data.list)
      if (!ovRes.success && !listRes.success) {
        setError(ovRes.error || listRes.error || t('common.failed'))
      }
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.invitations')}</h3>
      </div>
      {overview ? (
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-base font-semibold tabular-nums">{overview.invitedCount}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">总邀请</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-base font-semibold tabular-nums">{overview.activeCount}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">活跃用户</div>
            </CardContent>
          </Card>
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        items.map((u) => (
          <Card key={u.id} className="rounded-md border-border shadow-none">
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
                  {initials(u.nickname)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{u.nickname}</span>
                  <Badge variant="secondary">{u.status}</Badge>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                  <span>{fmtDate(u.joinedAt)}</span>
                  <span className="text-primary tabular-nums">
                    贡献 ¥{fmtMoney(u.totalCommission)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
