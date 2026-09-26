// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { QRCodeCanvas } from 'qrcode.react'
import { Crown, Check, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { useAnalytics } from '@/hooks/use-analytics'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

interface VipLevel {
  id: string
  levelName: string
  levelValue: number
  price: number
  durationDays: number
  benefits: string[]
  status: number
  sortOrder: number
}

interface PayInfo {
  mock: boolean
  method: 'jsapi' | 'native' | 'h5' | 'alipay'
  codeUrl?: string
  h5Url?: string
  payUrl?: string
  error?: string
}

interface OrderResult {
  orderId: string
  orderNo: string
  amount: number
  vipLevelId: string
  payInfo: PayInfo
}

interface PayStatusResult {
  status: 'pending' | 'paid' | string
  payInfo?: PayInfo
}

type PaymentMethod = 'wechat' | 'alipay'

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const formatCNY = (cents: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(cents / 100)

function DetailsContent() {
  const t = useTranslations('vip')
  const tc = useTranslations('common')
  const tp = useTranslations('payment')
  const searchParams = useSearchParams()
  const levelId = searchParams.get('levelId') ?? ''

  const [method, setMethod] = React.useState<PaymentMethod>('wechat')
  const [order, setOrder] = React.useState<OrderResult | null>(null)
  const [paid, setPaid] = React.useState(false)
  const { track } = useAnalytics()

  const METHODS: { id: PaymentMethod; label: string }[] = [
    { id: 'wechat', label: tp('checkout.wechat') },
    { id: 'alipay', label: tp('checkout.alipay') },
  ]

  const { data, isLoading, error } = useQuery({
    queryKey: ['vip-levels'],
    queryFn: () => api<{ items: VipLevel[] }>('/api/vip/levels'),
  })

  const levels = data?.items ?? []
  const level = levels.find((l) => l.id === levelId)

  const orderMut = useMutation({
    mutationFn: (vipLevelId: string) =>
      api<OrderResult>('/api/vip/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vipLevelId,
          paymentMethod: method === 'alipay' ? 'alipay' : 'wechat_native',
        }),
      }),
    onSuccess: (data) => {
      setOrder(data)
    },
  })

  React.useEffect(() => {
    if (!order?.orderNo) return
    let stop = false
    const poll = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 3000))
        if (stop) break
        try {
          const r = await api<PayStatusResult>(`/api/vip/order/${order.orderNo}/payinfo`)
          if (r.status === 'paid') {
            setPaid(true)
            // 埋点:VIP 支付成功
            track({
              name: 'payment_success',
              category: 'commerce',
              label: 'vip',
              props: { method },
            })
            return
          }
        } catch {
          // 忽略轮询错误
        }
      }
    }
    poll()
    return () => {
      stop = true
    }
  }, [order?.orderNo, method, track])

  const benefits = level && Array.isArray(level.benefits) ? level.benefits : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t('loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {(error as Error).message}
      </div>
    )
  }

  if (paid) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-10 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="text-2xl font-bold tracking-tight">{t('purchaseSuccess')}</h1>
        <Button asChild>
          <Link href="/vip">{tc('back')}</Link>
        </Button>
      </div>
    )
  }

  if (order && (order.payInfo?.codeUrl || order.payInfo?.payUrl)) {
    const isAlipay = Boolean(order.payInfo?.payUrl)
    const qrValue = order.payInfo?.payUrl ?? order.payInfo?.codeUrl ?? ''
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {isAlipay ? '支付宝扫码支付' : '微信扫码支付'}
        </h1>
        <p className="text-sm text-muted-foreground">
          金额：<span className="font-bold text-foreground">{formatCNY(order.amount)}</span>
        </p>
        <div className="flex justify-center rounded-lg border border-border bg-white p-3">
          <QRCodeCanvas value={qrValue} size={240} level="M" />
        </div>
        <p className="text-xs text-muted-foreground">
          {isAlipay ? '请用支付宝扫描二维码完成支付' : '请用微信扫描二维码完成支付'}
        </p>
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          等待支付确认中,支付完成后本页自动更新
        </p>
        <p className="text-xs text-muted-foreground">订单号：{order.orderNo}</p>
        <Button variant="outline" onClick={() => setOrder(null)}>
          {tc('back')}
        </Button>
      </div>
    )
  }

  if (order && order.payInfo?.mock) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-10 text-center">
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-700">
          支付通道暂未开通（微信/支付宝商户配置缺失），订单已创建但无法支付。
          <br />
          订单号：{order.orderNo}。请联系管理员在服务端配置支付商户后重试。
        </div>
        <Button asChild>
          <Link href="/vip">{tc('back')}</Link>
        </Button>
      </div>
    )
  }

  if (order && order.payInfo?.error) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-10 text-center">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          下单失败：{order.payInfo.error}
        </div>
        <Button variant="outline" onClick={() => setOrder(null)}>
          {tc('back')}
        </Button>
      </div>
    )
  }

  if (!level) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 py-10 text-center">
        <Crown className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        <Button asChild variant="outline">
          <Link href="/vip">{tc('back')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-4xl space-y-4">
      <Link
        href="/vip"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </Link>

      <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">{t('details')}</h1>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-5">
        <div className="min-[1024px]:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">{level.levelName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl min-[768px]:text-3xl font-bold">
                  {formatCNY(level.price)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t('durationDays', { days: level.durationDays })}
                </span>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t('benefits')}</p>
                {benefits.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {benefits.map((b, i) => (
                      <li key={`benefit-${i}`} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('empty')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-[1024px]:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('choosePlan')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    method === m.id ? 'border-brand-accent-deep bg-primary/5' : 'hover:bg-accent',
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-medium">{m.label}</span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4 transition-opacity',
                      method === m.id ? 'opacity-100 text-primary' : 'opacity-0',
                    )}
                  />
                </label>
              ))}

              {orderMut.isError ? (
                <p className="pt-2 text-sm text-destructive">
                  {t('purchaseFail')}: {(orderMut.error as Error).message}
                </p>
              ) : null}

              <Button
                className="mt-4 w-full"
                size="lg"
                disabled={orderMut.isPending}
                onClick={() => orderMut.mutate(level.id)}
              >
                {orderMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('subscribe')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function VipDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        </div>
      }
    >
      <DetailsContent />
    </Suspense>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
