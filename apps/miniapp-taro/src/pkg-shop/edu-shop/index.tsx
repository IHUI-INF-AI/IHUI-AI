// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/edu-shop/EduShopScreen.tsx
// 双 Tab(课程商品 / 我的订单)镜像 RN 共享屏;语义档类名与 RN token 同源。
// 端点与 RN 薄壳同源:GET /api/edu/courses、GET /api/edu/orders/my、
// POST /api/edu/orders {orderType,targetId,targetTitle}、POST /api/edu/orders/:id/cancel。
import { useCallback, useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'

interface CourseRow {
  id: string
  title: string
  coverImage?: string | null
  price?: string | null
  originalPrice?: string | null
  isFree?: boolean
  lecturerName?: string | null
  lessonCount?: number | null
}

interface OrderRow {
  id: string
  orderNo: string
  targetTitle?: string | null
  quantity: number
  payAmount?: string | null
  status: string
  createdAt?: string | null
}

const COURSES_PAGE_SIZE = 12
const ORDERS_PAGE_SIZE = 10

export default function EduShopPage() {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<'courses' | 'orders'>('courses')
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [coursesTotal, setCoursesTotal] = useState(0)
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersLoading, setOrdersLoading] = useState(false)

  const fmtDate = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadCourses = useCallback(
    async (page: number, append: boolean) => {
      setCoursesLoading(true)
      try {
        const res = await get<{ list: CourseRow[]; total: number }>(
          `/edu/courses?page=${page}&pageSize=${COURSES_PAGE_SIZE}`,
        )
        const list = res?.list ?? []
        setCourses((prev) => (append ? [...prev, ...list] : list))
        setCoursesTotal(res?.total ?? list.length)
      } catch {
        Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
      } finally {
        setCoursesLoading(false)
      }
    },
    [t],
  )

  const loadOrders = useCallback(
    async (page: number, append: boolean) => {
      setOrdersLoading(true)
      try {
        const res = await get<{ list: OrderRow[]; total: number }>(
          `/edu/orders/my?page=${page}&pageSize=${ORDERS_PAGE_SIZE}`,
        )
        const list = res?.list ?? []
        setOrders((prev) => (append ? [...prev, ...list] : list))
        setOrdersTotal(res?.total ?? list.length)
      } catch {
        Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
      } finally {
        setOrdersLoading(false)
      }
    },
    [t],
  )

  useDidShow(() => {
    if (tab === 'courses' && courses.length === 0) void loadCourses(1, false)
    if (tab === 'orders' && orders.length === 0) void loadOrders(1, false)
  })

  const onBuy = useCallback(
    async (c: CourseRow) => {
      try {
        await post('/edu/orders', { orderType: 'course', targetId: c.id, targetTitle: c.title })
        Taro.showToast({ title: t('eduShop.orderCreated'), icon: 'success' })
        setOrders([])
        if (tab === 'orders') void loadOrders(1, false)
      } catch {
        Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
      }
    },
    [tab, loadOrders, t],
  )

  const onCancel = useCallback(
    async (o: OrderRow) => {
      try {
        await post(`/edu/orders/${o.id}/cancel`, {})
        setOrders([])
        void loadOrders(1, false)
      } catch {
        Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
      }
    },
    [loadOrders, t],
  )

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduShop.status.${s}`)
      return v === `eduShop.status.${s}` ? s : v
    },
    [t],
  )

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-4">
        <View className="flex items-center gap-3 py-3">
          <Text className="text-xl font-bold text-foreground">{t('eduShop.title')}</Text>
        </View>

        <View className="flex gap-2 pb-3">
          <Button
            size="mini"
            onClick={() => {
              setTab('courses')
              if (courses.length === 0) void loadCourses(1, false)
            }}
          >
            {t('eduShop.courses')}
          </Button>
          <Button
            size="mini"
            onClick={() => {
              setTab('orders')
              if (orders.length === 0) void loadOrders(1, false)
            }}
          >
            {t('eduShop.orders')}
          </Button>
        </View>

        {tab === 'courses' ? (
          coursesLoading && courses.length === 0 ? (
            <ScreenSkeleton variant="card" />
          ) : courses.length === 0 ? (
            <EmptyState title={t('eduShop.emptyCourses')} />
          ) : (
            <View className="space-y-4">
              {courses.map((c) => (
                <View
                  key={c.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  {c.coverImage ? (
                    <Image
                      src={c.coverImage}
                      className="w-full h-[140px] bg-muted"
                      mode="aspectFill"
                    />
                  ) : null}
                  <View className="p-4 space-y-1">
                    <Text className="text-base font-semibold text-foreground">{c.title}</Text>
                    {(c.lecturerName || (c.lessonCount ?? 0) > 0) && (
                      <Text className="text-xs text-muted-foreground">
                        {[
                          c.lecturerName,
                          (c.lessonCount ?? 0) > 0
                            ? t('eduShop.lessons', { n: c.lessonCount ?? 0 })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    )}
                    <View className="flex items-center justify-between mt-1">
                      {c.isFree ? (
                        <Text className="text-sm font-semibold text-emerald-600">
                          {t('eduShop.free')}
                        </Text>
                      ) : (
                        <View className="flex items-baseline gap-2">
                          <Text className="text-base font-semibold text-primary">
                            {c.price ?? '—'}
                          </Text>
                          {c.originalPrice ? (
                            <Text className="text-xs text-muted-foreground line-through">
                              {c.originalPrice}
                            </Text>
                          ) : null}
                        </View>
                      )}
                      <Button
                        size="mini"
                        className="bg-cta text-cta-foreground rounded-sm"
                        onClick={() => void onBuy(c)}
                      >
                        {t('eduShop.buy')}
                      </Button>
                    </View>
                  </View>
                </View>
              ))}
              {courses.length < coursesTotal ? (
                <Button
                  size="mini"
                  onClick={() =>
                    void loadCourses(Math.ceil(courses.length / COURSES_PAGE_SIZE) + 1, true)
                  }
                >
                  {t('eduShop.loadMore')}
                </Button>
              ) : null}
            </View>
          )
        ) : ordersLoading && orders.length === 0 ? (
          <ScreenSkeleton variant="list" />
        ) : orders.length === 0 ? (
          <EmptyState title={t('eduShop.emptyOrders')} />
        ) : (
          <View className="space-y-4">
            {orders.map((o) => (
              <View key={o.id} className="rounded-lg border border-border bg-card p-4 space-y-1">
                <View className="flex items-center justify-between gap-2">
                  <Text className="flex-1 text-base font-semibold text-foreground truncate">
                    {o.targetTitle ?? o.orderNo}
                  </Text>
                  <Text className="text-xs text-muted-foreground">{statusLabel(o.status)}</Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {o.orderNo} · x{o.quantity} · {fmtDate(o.createdAt)}
                </Text>
                <View className="flex items-center justify-between mt-1">
                  <Text className="text-base font-semibold text-primary">{o.payAmount ?? '—'}</Text>
                  {o.status === 'pending' ? (
                    <Button size="mini" onClick={() => void onCancel(o)}>
                      {t('eduShop.cancelOrder')}
                    </Button>
                  ) : null}
                </View>
              </View>
            ))}
            {orders.length < ordersTotal ? (
              <Button
                size="mini"
                onClick={() =>
                  void loadOrders(Math.ceil(orders.length / ORDERS_PAGE_SIZE) + 1, true)
                }
              >
                {t('eduShop.loadMore')}
              </Button>
            ) : null}
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
