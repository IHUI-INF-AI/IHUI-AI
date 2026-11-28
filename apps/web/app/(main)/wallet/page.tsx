// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Wallet,
  Plus,
  ArrowDownToLine,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  CreditCard,
} from 'lucide-react'

import { apiOrThrow } from '@/lib/api'
import type { WalletOverview } from '@ihui/types'
import {
  Button,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
} from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { resolveWalletFlowMeta } from '@ihui/shared/utils/wallet-flow-meta'
import { formatCnyCents } from '@/lib/display-currency'
import { AuthGatePrompt, BackButton } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'

interface BalanceData {
  balance: number
}

interface FlowItem {
  id: string
  opType: number
  quantity: number
  balanceAfter: number
  remark: string | null
  createdAt: string
}

interface FlowsData {
  items: FlowItem[]
  total: number
}

const PAGE_SIZE = 20

export default function WalletPage() {
  const t = useTranslations('wallet')
  const tb = useTranslations('bankCard')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [convertAmount, setConvertAmount] = React.useState('100')
  const [converting, setConverting] = React.useState(false)
  const [convertMessage, setConvertMessage] = React.useState<string | null>(null)

  // 2026-09-30 登录态门
  const { allow } = useAuthGate()
  const balanceQ = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: () => apiOrThrow<BalanceData>('/api/finance/margin/balance'),
    enabled: allow,
  })
  const flowsQ = useQuery({
    queryKey: ['wallet', 'flows', page],
    queryFn: () =>
      apiOrThrow<FlowsData>(`/api/finance/margin/flows?page=${page}&limit=${PAGE_SIZE}`),
    enabled: allow,
  })
  // 统一账户总览：佣金累计 / 可提现 / 在途提现 / 已提现
  const overviewQ = useQuery({
    queryKey: ['wallet', 'overview'],
    queryFn: () => apiOrThrow<WalletOverview>('/api/wallet/overview'),
    enabled: allow,
  })

  const total = flowsQ.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const items = flowsQ.data?.items ?? []
  const overview = overviewQ.data

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const fmtDate = (v: string) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
  }

  const onConvertToPoints = async () => {
    const amount = Number.parseInt(convertAmount, 10)
    if (!Number.isFinite(amount) || amount < 100) {
      setConvertMessage(t('convertBelowMin'))
      return
    }
    setConverting(true)
    setConvertMessage(null)
    try {
      const result = await apiOrThrow<{
        points: number
        walletBalance: number
        pointsBalance: number
        alreadyExchanged: boolean
      }>('/api/wallet/convert-to-points', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `wallet-convert-${Date.now()}`,
        }),
      })
      setConvertMessage(
        result.alreadyExchanged
          ? t('convertAlreadyDone')
          : t('convertSuccess', { points: result.points, balance: result.pointsBalance }),
      )
      await queryClient.invalidateQueries({ queryKey: ['wallet'] })
    } catch (e) {
      setConvertMessage((e as Error).message || t('convertFailed'))
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-5xl space-y-4">
      <BackButton />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-heading font-bold tracking-tight min-[768px]:text-display">
          <Wallet className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
      </header>

      {/* 2026-09-30 登录态门 */}
      {!allow ? (
        <AuthGatePrompt message={t('loginRequired')} />
      ) : balanceQ.error ? (
        <div className="rounded-lg border bg-destructive/10 p-3 text-body text-destructive">
          {(balanceQ.error as Error).message}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-[160px] min-[640px]:min-w-[200px] flex-1 rounded-lg border bg-card p-3 text-card-foreground shadow-elevation-md">
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">{t('balance')}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Image
                  src="/images/common/wallet.svg"
                  alt=""
                  aria-hidden
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px]"
                  unoptimized
                />
              </div>
            </div>
            <div className="mt-2 text-display font-bold tracking-tight">
              {balanceQ.isLoading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-muted" />
              ) : (
                // 余额单位是「分」：充值回调 rechargeToken(order.amount) 落的就是订单分金额
                // （services/order-service.ts rechargeIfTokenOrder），直接渲染会放大 100 倍。
                formatCnyCents(balanceQ.data?.balance ?? 0, { digits: 2 })
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/wallet/recharge">
              <Button>
                <Plus className="h-4 w-4" />
                {t('recharge')}
              </Button>
            </Link>
            <Link href="/wallet/withdraw">
              <Button variant="outline">
                <ArrowDownToLine className="h-4 w-4" />
                {t('withdraw')}
              </Button>
            </Link>
            <Link href="/wallet/bank-cards">
              <Button variant="outline">
                <CreditCard className="h-4 w-4" />
                {tb('title')}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {allow && overview ? (
        <section className="rounded-lg border bg-card p-3 text-card-foreground shadow-elevation-md">
          <h2 className="text-body font-semibold">{t('overviewTitle')}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
            {[
              { label: t('withdrawable'), value: overview.withdrawableCents, primary: true },
              { label: t('withdrawalPending'), value: overview.withdrawalPendingCents },
              { label: t('commissionTotal'), value: overview.commissionTotalCents },
              { label: t('withdrawn'), value: overview.withdrawnCents },
            ].map((row) => (
              <div key={row.label} className="rounded-md bg-muted/50 p-2">
                <div className="text-label text-muted-foreground">{row.label}</div>
                <div className={cn('mt-1 text-body font-semibold', row.primary && 'text-primary')}>
                  {formatCnyCents(row.value, { digits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {allow && (
        <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-elevation-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <span className="text-body font-semibold">{t('convertTitle')}</span>
            </div>
            <span className="text-label text-muted-foreground">{t('convertRule')}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={100}
              step={100}
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="w-40"
              aria-label="兑换积分数"
            />
            <Button onClick={onConvertToPoints} disabled={converting}>
              {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              兑换
            </Button>
            <span className="text-label text-muted-foreground">{t('convertMinHint')}</span>
          </div>
          {convertMessage ? (
            <p className="mt-2 text-label text-muted-foreground">{convertMessage}</p>
          ) : null}
        </div>
      )}

      {allow && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t('flows')}</h2>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="px-4 py-2.5">{t('flowType')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('flowAmount')}</TableHead>
                  <TableHead className="px-4 py-2.5 text-right">{t('flowBalance')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('flowTime')}</TableHead>
                  <TableHead className="px-4 py-2.5">{t('flowRemark')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flowsQ.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      {t('loading')}
                    </TableCell>
                  </TableRow>
                ) : flowsQ.error ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-destructive">
                      {(flowsQ.error as Error).message}
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => {
                    const meta = resolveWalletFlowMeta(it.opType, it.quantity)
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="px-4 py-2.5 font-medium">
                          {t(meta.labelKey)}
                        </TableCell>
                        <TableCell
                          className={cn('px-4 py-2.5 text-right font-medium', meta.colorClass)}
                        >
                          {meta.isMoney ? (
                            <>
                              {meta.sign === 'positive' ? '+' : meta.sign === 'negative' ? '-' : ''}
                              {formatCnyCents(
                                meta.sign === 'neutral' ? it.quantity : Math.abs(it.quantity),
                                { digits: 2 },
                              )}
                            </>
                          ) : (
                            <>{it.quantity}</>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-right text-muted-foreground">
                          {formatCnyCents(it.balanceAfter, { digits: 2 })}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-muted-foreground">
                          {fmtDate(it.createdAt)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-muted-foreground">
                          {it.remark ?? '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <span className="text-body text-muted-foreground">
                {total} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-body text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
