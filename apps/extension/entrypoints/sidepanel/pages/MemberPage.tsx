/**
 * MemberPage — 会员中心(2026-07-25 立)。
 *
 * 数据源:getMyMemberInfo() + getMemberLevels()(learn.ts)。
 * 顶部:当前会员状态卡(等级/积分/到期);下方:会员等级列表(含最低积分与折扣)。
 */
import { useEffect, useState } from 'react'
import { getMyMemberInfo, getMemberLevels, type Member, type MemberLevel } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateWithYear as fmtDate } from '../../../lib/date-utils'

export default function MemberPage() {
  const { t } = useI18n()
  const [member, setMember] = useState<Member | null>(null)
  const [levels, setLevels] = useState<MemberLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [memRes, lvlRes] = await Promise.all([getMyMemberInfo(), getMemberLevels()])
      if (memRes.success) setMember(memRes.data)
      if (lvlRes.success) setLevels(lvlRes.data)
      if (!memRes.success && !lvlRes.success) {
        setError(memRes.error || lvlRes.error || t('common.failed'))
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.member')}</h3>
      </div>
      {member ? (
        <Card className={member.status === 'active' ? 'border-primary/40' : ''}>
          <CardHeader className="p-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span>{member.levelName || `LV${member.level}`}</span>
              {member.status === 'active' ? (
                <Badge>生效中</Badge>
              ) : (
                <Badge variant="secondary">
                  {member.status === 'expired' ? '已过期' : '未生效'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xs text-muted-foreground space-y-1">
              <div>积分:{member.points}</div>
              {member.expireAt ? <div>到期:{fmtDate(member.expireAt)}</div> : <div>永久会员</div>}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="text-xs text-muted-foreground px-1 pt-1">{t('apps.memberDesc')}</div>
      {levels.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        levels.map((lv) => (
          <Card
            key={lv.id}
            className="rounded-md border-border shadow-none hover:bg-muted/50 transition-colors"
          >
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{lv.name}</div>
                {lv.description ? (
                  <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                    {lv.description}
                  </div>
                ) : null}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  需 {lv.minPoints} 积分{lv.discount ? ` · ${(lv.discount * 10).toFixed(0)} 折` : ''}
                </div>
              </div>
              {member?.level === lv.level ? <Badge variant="secondary">当前</Badge> : null}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
