// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowUpRight, Loader2, Receipt, Undo2, Wallet } from 'lucide-react'

import type { SkillEarningsResponse } from '@ihui/shared/skills/market'
import { Badge } from '@/components/data'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { fetchSkillEarnings } from '@/lib/skills-market-api'
import { apiOrThrow } from '@/lib/api'
import { useAuthGate } from '@/hooks/use-auth-gate'

function yuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`
}

export default function SkillEarningsPage() {
  const t = useTranslations('skillMarket')
  const tWallet = useTranslations('wallet')
  const tGate = useTranslations('chatHistory')
  const { allow } = useAuthGate()

  const query = useQuery({
    queryKey: ['skills-market', 'earnings'],
    queryFn: () => fetchSkillEarnings(),
    enabled: allow,
  })

  // 可提现额度是账户级口径（包含技能分成与其他有效佣金），
  // 与提现页共用同一 queryKey，避免两个页面各自缓存出不同数字。
  const availableQuery = useQuery({
    queryKey: ['wallet', 'withdrawal', 'available'],
    queryFn: () => apiOrThrow<{ available: number }>('/api/finance/withdrawal/available'),
    enabled: allow,
  })

  const data: SkillEarningsResponse | undefined = query.data
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  // 新旧接口滚动期兼容：旧接口没有净值/退款字段，缺省时按“毛额=净额”显示，
  // 不把 undefined 折成 NaN；退款状态缺省按在购处理（旧接口只返回 paid）。
  const gross = Number(data?.totalAuthorShareCents ?? 0)
  const clawback = Number(data?.sellerClawbackCents ?? 0)
  const net = Number(data?.netAuthorShareCents ?? gross - clawback)
  const legacyRecords = (data as (SkillEarningsResponse & { records?: number }) | undefined)
    ?.records
  const paidCount = Number(data?.paidCount ?? legacyRecords ?? 0)
  const refundedCount = Number(data?.refundedCount ?? 0)
  const items = (data?.items ?? []).map((item) => {
    const sellerClawbackCents = item.sellerClawbackCents ?? null
    return {
      ...item,
      status: item.status === 'refunded' ? ('refunded' as const) : ('paid' as const),
      sellerClawbackCents,
      netAuthorShareCents:
        item.netAuthorShareCents ?? item.authorShareCents - (sellerClawbackCents ?? 0),
    }
  })
  const availableCents = Math.max(0, Number(availableQuery.data?.available ?? 0))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4">
      <BackButton />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <h1 className="text-display font-bold tracking-tight">{t('earningsTitle')}</h1>
          </div>
          <p className="text-label text-muted-foreground">{t('earningsSubtitle')}</p>
        </div>
        <Link
          href="/skills-market"
          className="inline-flex items-center gap-1 text-label text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('backToMarket')}
        </Link>
      </header>

      {!allow ? (
        <AuthGatePrompt message={tGate('loginRequired')} />
      ) : query.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border py-12 text-body text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('loading')}
        </div>
      ) : query.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-body text-destructive">
          {(query.error as Error).message || t('loadFailed')}
        </div>
      ) : !data || items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Receipt className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-body font-medium">{t('earningsEmpty')}</p>
          <p className="mt-1 text-label text-muted-foreground">{t('earningsEmptyHint')}</p>
          <Link
            href="/skills-market"
            className="mt-4 inline-flex items-center gap-1 text-label text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('backToMarket')}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label={t('earningsNet')}
              value={yuan(net)}
              detail={`${t('earningsGross')} ${yuan(gross)}`}
              tone="primary"
            />
            <SummaryCard
              label={t('earningsClawback')}
              value={yuan(clawback)}
              detail={`${t('earningsRefundedCount')} ${refundedCount}`}
            />
            <SummaryCard
              label={t('earningsPaidCount')}
              value={String(paidCount)}
              detail={data.lastEarnedAt ? dateFmt.format(new Date(data.lastEarnedAt)) : '—'}
            />
            <SummaryCard
              label={t('earningsRefundedCount')}
              value={String(refundedCount)}
              detail={`${yuan(net)} ${t('earningsNet')}`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-label text-muted-foreground">{tWallet('availableAmount')}</div>
                <div className="text-title font-semibold tabular-nums">
                  {availableQuery.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : availableQuery.error ? (
                    '—'
                  ) : (
                    yuan(availableCents)
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/wallet/withdraw"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-label font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {tWallet('withdrawBtn')}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/wallet/withdraw/records"
                className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-label font-medium hover:bg-muted/40"
              >
                {tWallet('withdrawRecords')}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-label text-muted-foreground">
            {t('earningsNote')}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-body">
              <thead className="bg-muted/50 text-left text-label uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('earningsTableTime')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('earningsTableSkill')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('earningsTablePrice')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('earningsTableAuthor')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('earningsTableStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(item.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{item.skillName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{yuan(item.priceCents)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <div className="font-medium">{yuan(item.netAuthorShareCents)}</div>
                      <div className="text-label text-muted-foreground">
                        {t('earningsTableAuthor')} {yuan(item.authorShareCents)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.status === 'paid' ? (
                        <Badge variant="primary">{t('earningsStatusPaid')}</Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="default" className="inline-flex items-center gap-1">
                            <Undo2 className="h-3 w-3" />
                            {t('earningsStatusRefunded')}
                          </Badge>
                          <div className="text-label text-muted-foreground">
                            {item.sellerClawbackCents === null
                              ? t('earningsClawbackMissing')
                              : t('earningsRefundDetail', {
                                  refund: yuan(item.priceCents),
                                  clawback: yuan(item.sellerClawbackCents),
                                })}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone?: 'primary'
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-label uppercase text-muted-foreground">{label}</div>
      <div
        className={
          tone === 'primary'
            ? 'mt-1 text-title font-semibold tabular-nums text-primary'
            : 'mt-1 text-title font-semibold tabular-nums'
        }
      >
        {value}
      </div>
      <div className="mt-1 truncate text-label text-muted-foreground">{detail}</div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
