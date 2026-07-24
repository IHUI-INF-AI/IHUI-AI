import { useEffect, useState } from 'react'
import {
  getMembershipInfo,
  getVipLevels,
  type MembershipInfo,
  type VipLevel,
} from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

export default function VipPage() {
  const { t } = useI18n()
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [levels, setLevels] = useState<VipLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [memRes, lvlRes] = await Promise.all([getMembershipInfo(), getVipLevels()])
      if (memRes.success) setMembership(memRes.data)
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.vip')}</h3>
      </div>
      {membership ? (
        <Card className={membership.isActive ? 'border-primary/40' : ''}>
          <CardHeader className="p-4">
            <CardTitle className="flex items-center gap-2">
              <span>{membership.levelName || `LV${membership.level}`}</span>
              {membership.isActive ? (
                <Badge>生效中</Badge>
              ) : (
                <Badge variant="secondary">未生效</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xs text-muted-foreground space-y-1">
              {membership.isPermanent ? (
                <div>永久会员</div>
              ) : membership.expireTime ? (
                <div>
                  到期:
                  {new Intl.DateTimeFormat('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(new Date(membership.expireTime))}
                </div>
              ) : null}
              {!membership.isPermanent && membership.daysRemaining >= 0 ? (
                <div>剩余 {membership.daysRemaining} 天</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="text-xs text-muted-foreground px-1 pt-1">{t('apps.vipDesc')}</div>
      {levels.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        levels.map((lv) => (
          <Card key={lv.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{lv.levelName}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {lv.durationDays > 0 ? `${lv.durationDays} 天` : '永久'}
                </div>
              </div>
              <div className="text-sm font-semibold tabular-nums shrink-0">
                ¥{' '}
                {lv.price.toLocaleString('zh-CN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
