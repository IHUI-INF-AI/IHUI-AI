'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Check, Loader2, ArrowLeft, Tag } from 'lucide-react'

import { Button, Input } from '@ihui/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { cn } from '@/lib/utils'

const formatCNY = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n)

const PLAN_PRICES: Record<string, { name: string; price: number }> = {
  free: { name: '免费版', price: 0 },
  pro: { name: '专业版', price: 99 },
  enterprise: { name: '企业版', price: 499 },
}

const DEFAULT_PLAN = { name: '专业版', price: 99 }

const METHODS = [
  { id: 'wechat', labelKey: 'checkout.wechat' },
  { id: 'alipay', labelKey: 'checkout.alipay' },
  { id: 'stripe', labelKey: 'checkout.stripe' },
  { id: 'usdc', labelKey: 'checkout.usdc' },
] as const

function CheckoutContent() {
  const t = useTranslations('payment')
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan') ?? 'pro'
  const plan = PLAN_PRICES[planId] ?? DEFAULT_PLAN

  const [method, setMethod] = React.useState<string>('wechat')
  const [coupon, setCoupon] = React.useState('')
  const [discount, setDiscount] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  const applyCoupon = () => {
    setDiscount(coupon.trim().toUpperCase() === 'IHUI20' ? 0.2 : 0)
  }

  const subtotal = plan.price
  const discountAmount = subtotal * discount
  const total = subtotal - discountAmount

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    window.setTimeout(() => setSubmitting(false), 1500)
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
                    method === m.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-accent',
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
                  <span className="font-medium">{t(m.labelKey)}</span>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4 transition-opacity',
                      method === m.id ? 'opacity-100 text-primary' : 'opacity-0',
                    )}
                  />
                </label>
              ))}
              <Button type="submit" className="mt-4 w-full" size="lg" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? t('checkout.processing') : `${t('checkout.payNow')} · ${formatCNY(total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
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
