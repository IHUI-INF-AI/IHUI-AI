// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { fetchApi, getOrders, getUserStatistics, type Order } from '@ihui/api-client'
import {
  MemberDashboardScreen as SharedMemberDashboardScreen,
  type MemberCardKey,
  type MemberOrderRow,
} from '@ihui/rn-app'
import { formatPrice } from '@ihui/shared/utils'

import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** `GET /api/members/me` 的真身(web 页读的扁平字段并不存在,见 my-member-queries.ts) */
interface MyMemberResp {
  member?: { vipLevel?: { levelName?: string | null; endTime?: string | null } | null } | null
}

const fmtDate = (v?: string | null) => {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * 会员中心首页(mobile-rn 宿主):四卡 + 有效期横幅 + 最近订单。
 * 数据是**组合**出来的(GET /api/members/me 不给积分/券数/订单数):
 *   积分 getuserStatistics().points / 券数 /api/coupons 的 total / 订单 getOrders().total + 最近 5 单。
 */
export function MemberDashboardScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [levelName, setLevelName] = useState('—')
  const [expireAtText, setExpireAtText] = useState<string | null>(null)
  const [points, setPoints] = useState(0)
  const [couponCount, setCouponCount] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [recentOrders, setRecentOrders] = useState<MemberOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [member, stats, coupons, orders] = await Promise.all([
        fetchApi<MyMemberResp>('/api/members/me'),
        getUserStatistics(),
        fetchApi<{ total?: number }>('/api/coupons', { params: { page: 1, pageSize: 1 } }),
        getOrders({ pageSize: 5 }),
      ])
      const lv = member.success ? (member.data?.member?.vipLevel ?? null) : null
      setLevelName(lv?.levelName?.trim() || '—')
      setExpireAtText(fmtDate(lv?.endTime))
      setPoints(stats.success ? (stats.data?.points ?? 0) : 0)
      setCouponCount(coupons.success ? (coupons.data?.total ?? 0) : 0)
      if (orders.success) {
        setOrderCount(orders.data?.total ?? 0)
        setRecentOrders(
          (orders.data?.list ?? []).map((o: Order) => ({
            orderNo: o.orderNo,
            title: o.targetTitle,
            amountText: formatPrice(o.payAmount),
            statusText: t(`memberDashboard.status.${o.status}`) || String(o.status),
            createdAt: fmtDate(o.createdAt) ?? '',
          })),
        )
      }
    } catch {
      setError(t('memberDashboard.loadFailed'))
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onPressCard = useCallback(
    (key: MemberCardKey) => {
      if (key === 'level') navigation.navigate('VipBenefit')
      else if (key === 'points') navigation.navigate('Points')
      else if (key === 'coupons') navigation.navigate('Coupon')
      else navigation.navigate('Order')
    },
    [navigation],
  )

  return (
    <SharedMemberDashboardScreen
      t={t}
      levelName={levelName}
      expireAtText={expireAtText}
      points={points}
      couponCount={couponCount}
      orderCount={orderCount}
      recentOrders={recentOrders}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onBack={() => navigation.goBack()}
      onPressCard={onPressCard}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
