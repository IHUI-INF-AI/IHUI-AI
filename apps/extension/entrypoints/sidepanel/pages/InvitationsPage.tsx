/**
 * InvitationsPage — 邀请记录(/me/invitations,2026-08-21 立)。
 * 展示邀请的好友列表,数据来自 GET /distribution/invited-users。
 */
import { useEffect, useState } from 'react'
import { Gift, User } from 'lucide-react'
import { getInvitedUsers, type InvitedUser } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDate } from '../../../lib/date-utils'

function isActive(status: string): boolean {
  return /active|1|已激活|活跃/i.test(status)
}

export default function InvitationsPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<InvitedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getInvitedUsers({ page: 1, pageSize: 30 })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 挂载时加载一次
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.invitations')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center text-muted-foreground py-10 px-4 text-sm">
          <span className="text-3xl" aria-hidden>
            <Gift size={28} className="shrink-0" />
          </span>
          <div>{t('page.invitations.empty')}</div>
        </div>
      ) : (
        items.map((u) => (
          <Card key={u.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-3 flex items-center gap-2.5 min-[640px]:p-3">
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt=""
                  className="w-10 h-10 rounded-md object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-muted shrink-0 flex items-center justify-center text-base">
                  <User size={20} className="text-muted-foreground" aria-hidden />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{u.nickname}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {t('page.invitations.joinedAt')} {fmtDate(u.joinedAt)}
                </div>
                {u.totalCommission ? (
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {t('page.invitations.commission')} {u.totalCommission}
                  </div>
                ) : null}
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${
                  isActive(u.status)
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isActive(u.status)
                  ? t('page.invitations.statusActive')
                  : t('page.invitations.statusInactive')}
              </span>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
