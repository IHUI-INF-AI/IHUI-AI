'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Loader2, ShoppingCart, Tag, Check } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Input } from '@/components/form'
import { cn } from '@/lib/utils'

interface CourseDetail {
  id: string
  title: string
  description?: string
  coverImage?: string | null
  price?: number | string
  originalPrice?: number | string | null
  teacherName?: string
  duration?: number
  lessonCount?: number
}

interface OrderCreateResp {
  orderNo: string
  payAmount: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

type PayMethod = 'wechat' | 'alipay'

function BuyConfirmContent() {
  const t = useTranslations('learnBuyConfirmPage')
  const tLearn = useTranslations('learn')
  const tc = useTranslations('common')
  const router = useRouter()
  const sp = useSearchParams()
  const courseId = sp.get('courseId') ?? ''
  const courseType = sp.get('type') ?? 'lesson'
  const [couponCode, setCouponCode] = React.useState('')
  const [payMethod, setPayMethod] = React.useState<PayMethod>('wechat')
  const [formError, setFormError] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['learn', 'course', 'buy', courseId],
    queryFn: () => api<{ course: CourseDetail } | CourseDetail>(`/api/learn/lessons/${courseId}`),
    enabled: !!courseId,
  })

  const course: CourseDetail | null = (() => {
    if (!data) return null
    if ((data as { course: CourseDetail }).course) return (data as { course: CourseDetail }).course
    return data as CourseDetail
  })()

  const price = Number(course?.price ?? 0)
  const originalPrice = course?.originalPrice ? Number(course.originalPrice) : null
  const discount = originalPrice && originalPrice > price ? originalPrice - price : 0

  const createMut = useMutation({
    mutationFn: async () => {
      setFormError(null)
      if (!courseId) {
        setFormError(t('missingCourse'))
        throw new Error('missing courseId')
      }
      if (price <= 0) {
        setFormError(t('freeCourseNoNeed'))
        throw new Error('free course')
      }
      const body: Record<string, unknown> = {
        type: courseType === 'vip' ? 'vip' : 'course',
        targetId: courseId,
      }
      if (couponCode.trim()) body.couponId = couponCode.trim()
      return api<OrderCreateResp>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: (d) =>
      router.push(`/learn/payment/confirm?orderNo=${encodeURIComponent(d.orderNo)}`),
    onError: (e: Error) => setFormError(e.message),
  })

  if (!courseId)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </button>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {t('missingCourseParam')}
        </div>
      </div>
    )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tc('back')}
      </button>
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ShoppingCart className="h-6 w-6 text-primary" />
        {t('title')}
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tLearn('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error)?.message ?? t('loadFailed')}
        </div>
      ) : !course ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {t('courseNotFound')}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('productInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="break-words text-sm font-medium">{course.title}</p>
              {course.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{course.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {course.teacherName && (
                  <span>{t('instructor', { name: course.teacherName })}</span>
                )}
                {typeof course.lessonCount === 'number' && (
                  <span>{t('lessonCount', { n: course.lessonCount })}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('couponCode')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative flex-1">
                <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder={t('couponPlaceholder')}
                  className="pl-8"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('payMethod')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(['wechat', 'alipay'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayMethod(m)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                    payMethod === m
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span>{m === 'wechat' ? t('wechatPay') : t('alipay')}</span>
                  {payMethod === m && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              {originalPrice && originalPrice > price && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('originalPrice')}</span>
                  <span className="text-muted-foreground line-through">¥{originalPrice}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('discount')}</span>
                  <span className="text-emerald-600">-¥{discount}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-medium">{t('actualPay')}</span>
                <span className="text-lg font-semibold text-primary">¥{price}</span>
              </div>
            </CardContent>
          </Card>

          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || price <= 0}>
              {createMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('confirmPurchase')}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              {tc('cancel')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export default function BuyConfirmPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </div>
      }
    >
      <BuyConfirmContent />
    </React.Suspense>
  )
}
