// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'
import { Gift, Loader2, Ticket, TrendingUp } from 'lucide-react'
import { Card, CardContent, Button, Input } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface TierInfo {
  fromTokens: number
  toTokens: number | null
  multiplier: number
  isCurrent: boolean
}
interface NextTier {
  threshold: number
  multiplier: number
  tokensToNext: number
}
interface TieredProgress {
  model: string
  currentTierMultiplier: number
  currentTokens: number
  tiers: TierInfo[]
  nextTier: NextTier | null
}
interface PromoCoupon {
  id: string
  code: string
  name: string
  type: 'discount' | 'deduction' | 'referral'
  value: string | null
  minSpend: number | null
  referrerGets: string | null
  referralValue: number | null
  applicableModels: string[] | null
  applicableScope: string
  totalQuota: number | null
  issuedCount: number
  perUserLimit: number
  startsAt: string
  expiresAt: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}
interface UserCoupon {
  id: string
  userId: string
  couponId: string
  status: 'unused' | 'used' | 'expired'
  referrerUserId: string | null
  referredBy: string | null
  usedAt: string | null
  usedOnOrderId: string | null
  usedOnCallLogId: string | null
  discountCents: number | null
  createdAt: string
}
interface CouponItem extends UserCoupon {
  coupon: PromoCoupon
}
interface CouponsData {
  list: CouponItem[]
  total: number
}

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function RelayBenefitsPage() {
  const t = useTranslations('developer')
  const locale = useLocale()
  const { success: toastSuccess, error: toastError } = useToast()
  const qc = useQueryClient()
  const num = new Intl.NumberFormat(locale)
  const [model, setModel] = React.useState('gpt-4o')
  const [code, setCode] = React.useState('')

  const tierQ = useQuery({
    queryKey: ['developer', 'relay', 'tiered-progress', model],
    queryFn: () =>
      apiGet<TieredProgress>(
        `/api/developer/relay/tiered-progress?model=${encodeURIComponent(model)}`,
      ),
    enabled: model.trim().length > 0,
  })
  const couponsQ = useQuery({
    queryKey: ['developer', 'relay', 'coupons'],
    queryFn: () => apiGet<CouponsData>('/api/developer/relay/coupons'),
  })
  const claimM = useMutation({
    mutationFn: async (inputCode: string) => {
      const r = await fetchApi<UserCoupon>('/api/developer/relay/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toastSuccess(t('couponClaimed'))
      setCode('')
      qc.invalidateQueries({ queryKey: ['developer', 'relay', 'coupons'] })
    },
    onError: (e: Error) => toastError(e.message),
  })

  const tier = tierQ.data
  const pct =
    tier && tier.nextTier
      ? Math.min(100, Math.round((tier.currentTokens / tier.nextTier.threshold) * 100))
      : 0

  return (
    <div className="px-4 py-4 space-y-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Gift className="h-6 w-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 区块 1: 阶梯计价进度 */}
      <Card>
        <CardContent className="min-[640px]:p-3 space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
              {t('tierTitle')}
            </h2>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('tierModel')}
              aria-label={t('tierModel')}
              className="h-8 w-36 text-xs"
            />
          </div>
          {tierQ.isLoading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('loading')}
            </div>
          )}
          {tierQ.error && <Alert variant="danger" description={(tierQ.error as Error).message} />}
          {tier && tier.tiers.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">{t('tierEmpty')}</p>
          )}
          {tier && tier.tiers.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-3">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">{t('tierCurrent')}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {tier.currentTierMultiplier.toFixed(2)}x
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">{t('tierUsed')}</p>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    {num.format(tier.currentTokens)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">{t('tierNext')}</p>
                  {tier.nextTier ? (
                    <p className="mt-0.5 text-sm font-semibold tabular-nums">
                      {num.format(tier.nextTier.threshold)} → {tier.nextTier.multiplier.toFixed(2)}x
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm font-medium">{t('tierMax')}</p>
                  )}
                </div>
              </div>
              {tier.nextTier && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-md bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('tierNextHint', { tokens: num.format(tier.nextTier.tokensToNext) })}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 区块 2: 优惠券 */}
      <Card>
        <CardContent className="min-[640px]:p-3 space-y-3 p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('couponTitle')}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('couponInput')}
              aria-label={t('couponInput')}
              className="h-9 flex-1 min-[640px]:max-w-xs"
            />
            <Button
              size="sm"
              disabled={claimM.isPending || code.trim().length === 0}
              onClick={() => claimM.mutate(code.trim())}
            >
              {claimM.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('couponClaiming')}
                </>
              ) : (
                t('couponClaim')
              )}
            </Button>
          </div>
          {claimM.isError && (
            <Alert variant="danger" description={(claimM.error as Error).message} />
          )}
          <p className="text-xs font-medium text-muted-foreground">{t('couponList')}</p>
          {couponsQ.isLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('loading')}
            </div>
          ) : (couponsQ.data?.list ?? []).length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{t('couponEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {(couponsQ.data?.list ?? []).map((c) => {
                const ct = c.coupon
                const desc =
                  ct.type === 'discount' && ct.value !== null
                    ? `${t('couponTypeDiscount')} · ${Math.round(Number(ct.value) * 10)}折`
                    : ct.type === 'deduction' && ct.value !== null
                      ? `${t('couponTypeDeduction')} · 满${((ct.minSpend ?? 0) / 100).toFixed(0)}元减${(Number(ct.value) / 100).toFixed(0)}元`
                      : ct.type === 'referral'
                        ? t('couponTypeReferral')
                        : ct.type
                const statusLabel =
                  c.status === 'used'
                    ? t('couponStatusUsed')
                    : c.status === 'expired'
                      ? t('couponStatusExpired')
                      : t('couponStatusUnused')
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ct.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <span
                      className={
                        c.status === 'unused'
                          ? 'shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400'
                          : 'shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                      }
                    >
                      {statusLabel}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
