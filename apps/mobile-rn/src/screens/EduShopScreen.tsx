// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育商城页(mobile-rn 端)—— 薄壳,渲染真相源在共享层
 * `packages/app/src/features/edu-shop/EduShopScreen.tsx`(经 `@ihui/rn-app` 具名导出)。
 * 本文件管平台侧:课程/订单取数与分页、下单/取消请求、提示、Intl 日期。
 *
 * 端点契约(与 web edu/shop/page.tsx 同源):
 *  - GET  /api/edu/courses?page&pageSize        ⇒ { list, total, page, pageSize }
 *  - GET  /api/edu/orders/my?page&pageSize      ⇒ { list, total, page, pageSize }
 *  - POST /api/edu/orders {orderType,targetId,targetTitle} ⇒ { order }
 *  - POST /api/edu/orders/:id/cancel            ⇒ 取消订单
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import {
  EduShopScreen as SharedEduShopScreen,
  type EduShopCourseView,
  type EduShopOrderView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useRefreshOnFocus } from '../hooks'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

const COURSES_PAGE_SIZE = 12
const ORDERS_PAGE_SIZE = 10

interface CourseRow extends EduShopCourseView {
  id: string
}

interface OrderRow extends EduShopOrderView {
  id: string
}

function EduShopScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  const [courses, setCourses] = useState<CourseRow[]>([])
  const [coursesTotal, setCoursesTotal] = useState(0)
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  const [actionPending, setActionPending] = useState(false)

  const fmtDate = useCallback(
    (iso: string | null) => {
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

  const loadCourses = useCallback(async (page: number, append: boolean) => {
    setCoursesLoading(true)
    setCoursesError(null)
    try {
      const res = await fetchApi<{ list: CourseRow[]; total: number }>(
        `/api/edu/courses?page=${page}&pageSize=${COURSES_PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      const list = res.data?.list ?? []
      setCourses((prev) => (append ? [...prev, ...list] : list))
      setCoursesTotal(res.data?.total ?? list.length)
    } catch (e) {
      setCoursesError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setCoursesLoading(false)
    }
  }, [])

  const loadOrders = useCallback(async (page: number, append: boolean) => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      const res = await fetchApi<{ list: OrderRow[]; total: number }>(
        `/api/edu/orders/my?page=${page}&pageSize=${ORDERS_PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      const list = res.data?.list ?? []
      setOrders((prev) => (append ? [...prev, ...list] : list))
      setOrdersTotal(res.data?.total ?? list.length)
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCourses(1, false)
  }, [loadCourses])

  const refreshOrders = useCallback(() => {
    void loadOrders(1, false)
  }, [loadOrders])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新):课程与订单一起刷
  const refreshOnFocus = useCallback(() => {
    void loadCourses(1, false)
    void loadOrders(1, false)
  }, [loadCourses, loadOrders])
  useRefreshOnFocus(refreshOnFocus)

  const onBuy = useCallback(
    async (course: EduShopCourseView) => {
      setActionPending(true)
      try {
        const res = await fetchApi('/api/edu/orders', {
          method: 'POST',
          body: JSON.stringify({
            orderType: 'course',
            targetId: course.id,
            targetTitle: course.title,
          }),
        })
        if (!res.success) throw new Error(res.error)
        void appAlert(t('eduShop.buy'), t('eduShop.orderCreated'))
        refreshOrders()
      } catch (e) {
        void appAlert(t('common.error'), e instanceof Error ? e.message : t('eduShop.buy'))
      } finally {
        setActionPending(false)
      }
    },
    [refreshOrders, t],
  )

  const onCancelOrder = useCallback(
    async (id: string) => {
      setActionPending(true)
      try {
        const res = await fetchApi(`/api/edu/orders/${id}/cancel`, { method: 'POST' })
        if (!res.success) throw new Error(res.error)
        refreshOrders()
      } catch (e) {
        void appAlert(t('common.error'), e instanceof Error ? e.message : t('eduShop.cancelOrder'))
      } finally {
        setActionPending(false)
      }
    },
    [refreshOrders, t],
  )

  const orderStatusLabel = useCallback(
    (status: string) => {
      const v = t(`eduShop.status.${status}`)
      return v === `eduShop.status.${status}` ? status : v
    },
    [t],
  )

  return (
    <SharedEduShopScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      courses={courses}
      coursesLoading={coursesLoading}
      coursesError={coursesError}
      hasMoreCourses={courses.length < coursesTotal}
      onLoadMoreCourses={() =>
        void loadCourses(Math.ceil(courses.length / COURSES_PAGE_SIZE) + 1, true)
      }
      onRetryCourses={() => void loadCourses(1, false)}
      orders={orders}
      ordersLoading={ordersLoading}
      ordersError={ordersError}
      hasMoreOrders={orders.length < ordersTotal}
      onLoadMoreOrders={() =>
        void loadOrders(Math.ceil(orders.length / ORDERS_PAGE_SIZE) + 1, true)
      }
      onRetryOrders={() => void loadOrders(1, false)}
      onBuy={(c) => void onBuy(c)}
      onCancelOrder={(id) => void onCancelOrder(id)}
      actionPending={actionPending}
      formatDate={fmtDate}
      orderStatusLabel={orderStatusLabel}
    />
  )
}

export default EduShopScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
