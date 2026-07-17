'use client'

import * as React from 'react'
import { Suspense, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Loader2, ArrowLeft, Tag } from 'lucide-react'

import { Button, Input } from '@ihui/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { useVipPayment } from '@/hooks/use-vip-payment'
import { useToast } from '@/hooks/use-toast'

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

const PLAN_PRICES: Record<string, { name: string; price: number }> = {
  free: { name: '免费版', price: 0 },
  pro: { name: '专业版', price: 99 },
  enterprise: { name: '企业版', price: 499 },
}

const DEFAULT_PLAN = { name: '专业版', price: 99 }

const METHODS = [
  { id: 'wechat_native', labelKey: 'checkout.wechat' },
  { id: 'alipay', labelKey: 'checkout.alipay' },
  { id: 'stripe', labelKey: 'checkout.stripe' },
  { id: 'usdc', labelKey: 'checkout.usdc' },
] as const

function CheckoutContent() {
  const t = useTranslations('payment')
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan') ?? 'pro'
  const plan = PLAN_PRICES[planId] ?? DEFAULT_PLAN

  const { createOrder, queryOrder, paying, payMethod, setPayMethod } = useVipPayment()
  const toast = useToast()
  const [coupon, setCoupon] = React.useState('')
  const [discount, setDiscount] = React.useState(0)
  const [polling, setPolling] = React.useState(false)
  const [qrCodeUrl, setQrCodeUrl] = React.useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyCoupon = () => {
    setDiscount(coupon.trim().toUpperCase() === 'IHUI20' ? 0.2 : 0)
  }

  const subtotal = plan.price
  const discountAmount = subtotal * discount
  const total = subtotal - discountAmount

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
      const status = await queryOrder(orderNo)
      if (status === 'paid') {
        stopPoll()
        setQrCodeUrl('')
        toast.success('支付成功')
        router.push('/payment')
        return
      }
      if (status === 'cancelled' || status === 'closed' || status === 'refunded' || count >= MAX) {
        stopPoll()
        toast.error('支付未完成', count >= MAX ? '支付超时,请重试' : '订单已关闭')
      }
    }, 2000)
  }

  const submitting = paying || polling

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    const order = await createOrder(planId)
    if (!order) return
    const info = order.payInfo
    if (info.mock && info.error) {
      toast.error('支付配置未就绪', '请联系管理员')
    } else if (info.method === 'native' && info.codeUrl) {
      setQrCodeUrl(info.codeUrl)
    } else if (info.method === 'h5' && info.h5Url) {
      window.location.href = info.h5Url
      return
    } else {
      toast.error('支付方式不支持')
    }
    startPolling(order.orderNo)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        href="/payment"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('checkout.back')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('checkout.title')}</h1>

      <form onSubmit={handlePay} className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('checkout.orderSummary')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.plan')}</span>
                <span className="font-medium">{plan.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('checkout.subtotal')}</span>
                <span>{formatCNY(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span>{t('checkout.discount')}</span>
                  <span>-{formatCNY(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>{t('checkout.total')}</span>
                <span>{formatCNY(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('checkout.coupon')}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={t('checkout.couponPlaceholder')}
                  className="pl-9"
                />
              </div>
              <Button type="button" variant="outline" onClick={applyCoupon}>
                {t('checkout.applyCoupon')}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
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
                    payMethod === m.id ? 'border-primary bg-primary/5' : 'hover:bg-accent',
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>微信扫码支付</DialogTitle>
            <DialogDescription>请使用微信扫描下方二维码,支付完成后自动跳转</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCodeUrl)}&size=240x240`}
              alt="微信支付二维码"
              className="h-60 w-60 rounded-lg border"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
