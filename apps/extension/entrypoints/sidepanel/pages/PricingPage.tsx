/**
 * PricingPage — 定价方案(/settings/pricing,2026-08-21 立)。
 * 展示 VIP 套餐列表(GET /api/vip/levels)+ 权益说明,并引导前往网页版开通。
 */
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { getVipLevels, type VipLevel } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { openInWeb } from '../../../lib/open-in-web'

function fmtPrice(p: number | undefined): string {
  if (typeof p !== 'number') return '—'
  return p.toLocaleString('zh-CN')
}

export default function PricingPage() {
  const { t } = useI18n()
  const [levels, setLevels] = useState<VipLevel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getVipLevels()
      if (!cancelled && res.success) {
        setLevels(
          res.data.filter((l) => l.status !== 0).sort((a, b) => a.levelValue - b.levelValue),
        )
      }
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.pricing')}</h3>
      </div>
      {!loading && levels.length > 0 ? (
        levels.map((l) => (
          <Card key={l.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{l.levelName}</span>
                <button
                  type="button"
                  onClick={() => openInWeb('/vip')}
                  className="px-2.5 py-1 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
                >
                  {t('page.pricing.open')} ↗
                </button>
              </div>
              <div className="text-[20px] font-semibold tabular-nums">
                ¥ {fmtPrice(l.price)}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {t('page.pricing.perMonth')}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t('page.pricing.duration')} {l.durationDays} {t('page.pricing.days')}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <div className="px-4 pt-3 pb-2 text-xs text-muted-foreground font-semibold">
            {t('page.pricing.benefitsTitle')}
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
      )}
      <p className="m-0 text-xs text-muted-foreground text-center">{t('page.pricing.note')}</p>
    </div>
  )
}
