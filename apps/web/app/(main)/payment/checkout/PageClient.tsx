// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { QRCodeCanvas } from 'qrcode.react'
import { Check, Loader2, ArrowLeft } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useVipPayment } from '@/hooks/use-vip-payment'
import { useToast } from '@/hooks/use-toast'

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

const PLAN_PRICES: Record<string, { price: number }> = {
  free: { price: 0 },
  pro: { price: 99 },
  enterprise: { price: 499 },
}

const DEFAULT_PRICE = 99

/** i18n 静态映射表 — 用于消除 plans.{planId}.name 形式的动态拼接 */
const PLAN_NAME_KEY: Record<string, string> = {
  free: 'plans.free.name',
  pro: 'plans.pro.name',
  enterprise: 'plans.enterprise.name',
}

// 2026-09-18 修复:移除 usdc 假选项(后端 /vip/order 仅实现微信+支付宝,
// 选择后会被静默当微信处理),仅保留真实可用的两种支付方式
const METHODS = [
  { id: 'wechat_native', labelKey: 'checkout.wechat' },
  { id: 'alipay', labelKey: 'checkout.alipay' },
] as const

function CheckoutContent() {
  const t = useTranslations('payment')
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawPlanId = searchParams.get('plan') ?? 'pro'
  const planId = PLAN_PRICES[rawPlanId] ? rawPlanId : 'pro'
  const plan = PLAN_PRICES[planId] ?? { price: DEFAULT_PRICE }

  const { createOrder, queryOrder, paying, payMethod, setPayMethod } = useVipPayment()
  const toast = useToast()
  const [polling, setPolling] = React.useState(false)
  const [qrCodeUrl, setQrCodeUrl] = React.useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 2026-09-18 修复:移除假优惠码(IHUI20 仅前端减价展示,下单金额不含折扣,
  // UI 显示折后价、实际支付原价)——折扣展示必须以服务端计价为准

  const subtotal = plan.price
  const total = subtotal

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }

  useEffect(() => () => stopPoll(), [])

  const startPolling = (orderNo: string) => {
    setPolling(true)
    let count = 0
    const MAX = 30
    pollRef.current = setInterval(async () => {
      count++
      try {
        const status = await queryOrder(orderNo)
        if (status === 'paid') {
          stopPoll()
          setQrCodeUrl('')
          toast.success(t('checkout.paySuccess'))
          router.push('/vip')
          return
        }
        if (
          status === 'cancelled' ||
          status === 'closed' ||
          status === 'refunded' ||
          count >= MAX
        ) {
          stopPoll()
          toast.error(
            t('checkout.payIncomplete'),
            count >= MAX ? t('checkout.payTimeout') : t('checkout.orderClosed'),
          )
        }
      } catch {
        // 轮询异常忽略,下一轮继续
      }
    }, 2000)
  }

  const submitting = paying || polling

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const order = await createOrder(planId)
      if (!order) return
      const info = order.payInfo
      if (info.mock && info.error) {
        toast.error(t('checkout.payConfigNotReady'), t('checkout.contactAdmin'))
      } else if (info.mock) {
        toast.error(t('checkout.payConfigNotReady'), t('checkout.contactAdmin'))
      } else if (info.method === 'native' && info.codeUrl) {
        setQrCodeUrl(info.codeUrl)
      } else if (info.method === 'alipay' && info.payUrl) {
        setQrCodeUrl(info.payUrl)
      } else if (info.method === 'h5' && info.h5Url) {
        window.location.href = info.h5Url
        return
      } else {
        toast.error(t('checkout.methodNotSupported'))
      }
      startPolling(order.orderNo)
    } catch (err) {
      // 2026-09-18 修复:createOrder 网络异常此前成为未捕获 rejection
      toast.error(err instanceof Error ? err.message : t('checkout.payIncomplete'))
    }
  }

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-4xl space-y-4">
      <Link
        href="/payment"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('checkout.back')}
      </Link>

      <h1 className="text-xl font-bold tracking-tight min-[768px]:text-2xl">
        {t('checkout.title')}
      </h1>

      <form onSubmit={handlePay} className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-5">
        <div className="space-y-4 min-[1024px]:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('checkout.orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.plan')}</span>
                <span className="font-medium">
                  {t(PLAN_NAME_KEY[planId] ?? 'plans.unknown.name')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
                <span>{formatCNY(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 text-base font-semibold">
                <span>{t('checkout.total')}</span>
                <span>{formatCNY(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-[1024px]:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('checkout.paymentMethod')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {METHODS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    payMethod === m.id
                      ? 'border-brand-accent-deep bg-primary/5'
                      : 'hover:bg-accent',
                  )}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={payMethod === m.id}
                    onChange={() => setPayMethod(m.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-medium">{t(m.labelKey)}</span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4 transition-opacity',
                      payMethod === m.id ? 'opacity-100 text-primary' : 'opacity-0',
                    )}
                  />
                </label>
              ))}
              <Button type="submit" className="mt-4 w-full" size="lg" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting
                  ? t('checkout.processing')
                  : `${t('checkout.payNow')} · ${formatCNY(total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>

      <Dialog open={!!qrCodeUrl} onOpenChange={(o) => !o && setQrCodeUrl('')}>
        <DialogContent className="min-[640px]:max-w-md">
          <DialogHeader>
            <DialogTitle>扫码支付</DialogTitle>
            <DialogDescription>请使用微信或支付宝扫描二维码完成支付</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2 rounded-lg border border-border bg-white">
            <QRCodeCanvas value={qrCodeUrl} size={240} level="M" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CheckoutPage() {
  const t = useTranslations('payment')
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('checkout.loading')}
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
