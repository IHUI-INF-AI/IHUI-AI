// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DistributionPage — 分销中心(/me/distribution,2026-08-21 立)。
 * 展示分销概览(GET /distribution/overview)与邀请信息(GET /distribution/invite-info),
 * 附参与引导与前往网页版入口。
 */
import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  getInviteInfo,
  getOverview,
  type CommissionOverview,
  type InviteInfo,
} from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { openInWeb } from '../../../lib/open-in-web'

function fmtMoney(n: number | undefined): string {
  if (typeof n !== 'number') return '—'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DistributionPage() {
  const { t } = useI18n()
  const [overview, setOverview] = useState<CommissionOverview | null>(null)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const overviewRes = await getOverview()
      const inviteRes = await getInviteInfo()
      if (!cancelled) {
        if (overviewRes.success) setOverview(overviewRes.data)
        if (inviteRes.success) setInvite(inviteRes.data)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.distribution')}</h3>
      </div>
      <Card>
        <CardContent className="p-4 flex items-center gap-2">
          <TrendingUp size={24} className="shrink-0" aria-hidden />
          <span className="text-sm">{t('page.distribution.desc')}</span>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-3 min-[640px]:p-3 text-center">
            <div className="text-xs text-muted-foreground">
              {t('page.distribution.totalCommission')}
            </div>
            <div className="text-sm font-semibold tabular-nums mt-1">
              {loading ? '—' : fmtMoney(overview?.totalCommission)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 min-[640px]:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('page.distribution.available')}</div>
            <div className="text-sm font-semibold tabular-nums mt-1">
              {loading ? '—' : fmtMoney(overview?.availableCommission)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 min-[640px]:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('page.distribution.invited')}</div>
            <div className="text-sm font-semibold tabular-nums mt-1">
              {loading ? '—' : (overview?.invitedCount ?? '—')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 min-[640px]:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t('page.distribution.rank')}</div>
            <div className="text-sm font-semibold tabular-nums mt-1">
              {loading ? '—' : (overview?.rank ?? '—')}
            </div>
          </CardContent>
        </Card>
      </div>
      {!loading && (invite || overview) ? (
        <Card>
          <div className="px-4 pt-3 pb-2 text-xs text-muted-foreground font-semibold">
            {t('page.distribution.guidanceTitle')}
          </div>
          <CardContent className="p-4 pt-1 flex flex-col gap-1.5 text-sm">
            {invite?.inviteCode ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('page.distribution.inviteCode')}:</span>
                <span className="font-mono font-semibold">{invite.inviteCode}</span>
              </div>
            ) : null}
            {invite?.commissionRate !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('page.distribution.rate')}:</span>
                <span>{(invite.commissionRate * 100).toFixed(1)}%</span>
              </div>
            ) : null}
            <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-xs">
              <div>{t('page.distribution.guidance1')}</div>
              <div>{t('page.distribution.guidance2')}</div>
              <div>{t('page.distribution.guidance3')}</div>
            </div>
            <button
              type="button"
              onClick={() => openInWeb('/distribution')}
              className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors self-start"
            >
              {t('page.distribution.open')} ↗
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="px-4 pt-3 pb-2 text-xs text-muted-foreground font-semibold">
            {t('page.distribution.guidanceTitle')}
          </div>
          <CardContent className="p-4 pt-1 flex flex-col gap-1.5 text-sm">
            <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
              <div>{t('page.distribution.guidance1')}</div>
              <div>{t('page.distribution.guidance2')}</div>
              <div>{t('page.distribution.guidance3')}</div>
            </div>
            <button
              type="button"
              onClick={() => openInWeb('/distribution')}
              className="mt-2 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors self-start"
            >
              {t('page.distribution.open')} ↗
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
