/**
 * VipPage — VIP 会员(/me/vip,2026-08-21 立)。
 * 展示当前会员状态(GET /api/vip/my)+ 权益说明,并引导前往网页版开通。
 */
import { useEffect, useState } from 'react'
import { Check, Crown } from 'lucide-react'
import { getMembershipInfo, type MembershipInfo } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { fmtDateOnly } from '../../../lib/date-utils'
import { openInWeb } from '../../../lib/open-in-web'

export default function VipPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<MembershipInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getMembershipInfo()
      if (!cancelled && res.success) setInfo(res.data)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const benefits = [
    'page.benefit1',
    'page.benefit2',
    'page.benefit3',
    'page.benefit4',
    'page.benefit5',
  ]

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.vip')}</h3>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Crown size={24} className="shrink-0" aria-hidden />
            {!loading && info?.isActive ? (
              <span className="text-sm font-semibold">
                {t('page.vip.active')} · {info.levelName || t('page.vip.level')} {info.level}
              </span>
            ) : (
              <span className="text-sm font-semibold">{t('page.vip.notActive')}</span>
            )}
          </div>
          {info?.isActive ? (
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('page.vip.level')}</dt>
                <dd className="m-0">{info.levelName || info.level}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('page.vip.expire')}</dt>
                <dd className="m-0">
                  {info.isPermanent
                    ? t('page.vip.permanent')
                    : info.expireTime
                      ? fmtDateOnly(info.expireTime)
                      : '—'}
                </dd>
              </div>
            </dl>
          ) : null}
          <button
            type="button"
            onClick={() => openInWeb('/vip')}
            className="mt-1 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors self-start"
          >
            {t('page.vip.upgrade')} ↗
          </button>
        </CardContent>
      </Card>
      <Card>
        <div className="px-4 pt-3 pb-2 text-xs text-muted-foreground font-semibold">
          {t('page.benefitsTitle')}
        </div>
        <CardContent className="p-4 pt-1 flex flex-col gap-1.5 text-sm">
          {benefits.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Check className="h-4 w-4" aria-hidden />
                {t(k)}
              </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
