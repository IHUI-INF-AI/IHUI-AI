'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ShoppingCart, Loader2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Card, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { ConfirmDialog } from '@/components/feedback'
import { toast } from '@/components/common'
import { BackButton } from '@/components/common'
import { cn } from '@/lib/utils'

interface Course {
  id: string
  title: string
  coverImage?: string | null
  intro?: string | null
  price?: string | null
  originalPrice?: string | null
  isFree?: boolean
  lecturerName?: string | null
  lessonCount?: number | null
}

interface CourseListData {
  list: Course[]
  total: number
  page: number
  pageSize: number
}

interface EduOrder {
  id: string
  orderNo: string
  targetTitle?: string | null
  quantity: number
  payAmount?: string | null
  status: string
  createdAt?: string | null
  updatedAt?: string | null
}

interface OrderListData {
  list: EduOrder[]
  total: number
  page: number
  pageSize: number
}

const COURSES_PAGE_SIZE = 12
const ORDERS_PAGE_SIZE = 10

// 订单状态徽章配色:paid 绿 / pending 黄 / cancelled 灰
const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600',
  pending: 'bg-amber-500/10 text-amber-600',
  cancelled: 'bg-slate-400/10 text-slate-500',
}

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function formatPrice(price: string | null | undefined, isFree?: boolean): string {
  if (isFree) return '¥0.00'
  const n = Number(price ?? '0')
  return `¥${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EduShopPage() {
  const t = useTranslations('eduAi.shop')
  const queryClient = useQueryClient()

  const [coursesPage, setCoursesPage] = React.useState(1)
  const [ordersPage, setOrdersPage] = React.useState(1)
  const [cancelId, setCancelId] = React.useState<string | null>(null)

  const coursesQuery = useQuery({
    queryKey: ['edu-shop', 'courses', coursesPage],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(coursesPage),
        pageSize: String(COURSES_PAGE_SIZE),
      })
      return api<CourseListData>(`/api/edu/courses?${qs.toString()}`)
    },
  })

  const ordersQuery = useQuery({
    queryKey: ['edu-shop', 'orders', ordersPage],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(ordersPage),
        pageSize: String(ORDERS_PAGE_SIZE),
      })
      return api<OrderListData>(`/api/edu/orders/my?${qs.toString()}`)
    },
  })

  const buyMutation = useMutation({
    mutationFn: async (course: Course) => {
      const r = await fetchApi<{ order: EduOrder }>('/api/edu/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderType: 'course',
          targetId: course.id,
          targetTitle: course.title,
        }),
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(t('orderSuccess'))
      queryClient.invalidateQueries({ queryKey: ['edu-shop', 'orders'] })
    },
    onError: () => {
      toast.error(t('orderFailed'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi<{ order: EduOrder }>(`/api/edu/orders/${id}/cancel`, {
        method: 'POST',
        body: '{}',
      })
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      toast.success(t('cancelSuccess'))
      setCancelId(null)
      queryClient.invalidateQueries({ queryKey: ['edu-shop', 'orders'] })
    },
    onError: () => {
      toast.error(t('cancelFailed'))
    },
  })

  const courses = coursesQuery.data
  const orders = ordersQuery.data
  const coursesTotalPages = Math.max(1, Math.ceil((courses?.total ?? 0) / COURSES_PAGE_SIZE))
  const ordersTotalPages = Math.max(1, Math.ceil((orders?.total ?? 0) / ORDERS_PAGE_SIZE))

  const handleCancelConfirm = () => {
    if (cancelId) cancelMutation.mutate(cancelId)
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShoppingCart className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>
          <TabsTrigger value="orders">{t('tabOrders')}</TabsTrigger>
        </TabsList>

        {/* ===== 全部课程 ===== */}
        <TabsContent value="all" className="space-y-4">
          {coursesQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : coursesQuery.isError ? (
            <Alert variant="danger" description={(coursesQuery.error as Error).message} />
          ) : (courses?.list ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
                {(courses?.list ?? []).map((course) => (
                  <Card key={course.id} className="flex flex-col">
                    <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                      {course.coverImage && (
                        <div className="aspect-video w-full overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={course.coverImage}
                            alt={course.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <p className="line-clamp-1 font-medium">{course.title}</p>
                      {course.intro && (
                        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                          {course.intro}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(course.price, course.isFree)}
                        </span>
                        <Button
                          size="sm"
                          disabled={buyMutation.isPending}
                          onClick={() => buyMutation.mutate(course)}
                        >
                          {buyMutation.isPending ? t('buying') : t('buy')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {(courses?.total ?? 0) > COURSES_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('page', { page: coursesPage, total: coursesTotalPages })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={coursesPage <= 1}
                      onClick={() => setCoursesPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={coursesPage >= coursesTotalPages}
                      onClick={() => setCoursesPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ===== 我的订单 ===== */}
        <TabsContent value="orders" className="space-y-4">
          {ordersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {t('loading')}
            </div>
          ) : ordersQuery.isError ? (
            <Alert variant="danger" description={(ordersQuery.error as Error).message} />
          ) : (orders?.list ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('ordersEmpty')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {(orders?.list ?? []).map((order) => (
                  <Card key={order.id}>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0 space-y-1">
                        <p className="line-clamp-1 font-medium">{order.targetTitle ?? '-'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t('orderNo')}: {order.orderNo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('createTime')}: {formatTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-primary">
                          {formatPrice(order.payAmount)}
                        </span>
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs',
                            STATUS_STYLE[order.status] ?? 'bg-muted text-muted-foreground',
                          )}
                        >
                          {t(order.status) ?? order.status}
                        </span>
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cancelMutation.isPending}
                            onClick={() => setCancelId(order.id)}
                          >
                            {t('cancelOrder')}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {(orders?.total ?? 0) > ORDERS_PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('page', { page: ordersPage, total: ordersTotalPages })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ordersPage <= 1}
                      onClick={() => setOrdersPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={ordersPage >= ordersTotalPages}
                      onClick={() => setOrdersPage((p) => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={cancelId !== null}
        title={t('cancelOrder')}
        content={t('confirmCancel')}
        confirmText={t('confirm')}
        cancelText={t('cancel')}
        loading={cancelMutation.isPending}
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelId(null)}
      />
    </div>
  )
}
