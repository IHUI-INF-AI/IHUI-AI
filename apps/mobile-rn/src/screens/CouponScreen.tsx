// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  CouponScreen as SharedCouponScreen,
  type CouponItem,
  type CouponStatus,
} from '@ihui/rn-app'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList, useRefreshOnFocus } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** GET /api/coupons 的响应行(与 web 会员券页同一份契约,字段名逐字对齐后端投影) */
interface CouponPage {
  list: Array<{
    id: string
    name: string
    amount: number
    minSpend: number
    expiresAt: string
    status: 'unused' | 'used' | 'expired'
  }>
  total: number
}

/**
 * 本屏 tab 词汇(共享屏的 available/used/expired)→ 后端档位词汇(库内 unused/used/expired)。
 * 只在端上映射一次:后端与 web/小程序都只认库内词汇。
 */
type CouponTab = 'available' | 'used' | 'expired'
const TAB_STATUS: Record<CouponTab, 'unused' | 'used' | 'expired'> = {
  available: 'unused',
  used: 'used',
  expired: 'expired',
}

const PAGE_SIZE = 20

export function CouponScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<CouponTab>('available')

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<CouponPage>('/api/coupons', {
        params: { page, pageSize, status: TAB_STATUS[statusTab] },
      })
      if (!res.success) return { success: false as const, error: t('coupon.loadFailed') }
      const list: CouponItem[] = (res.data?.list ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        minSpend: c.minSpend,
        validUntil: formatDateOnly(c.expiresAt),
        status: c.status === 'unused' ? 'available' : c.status,
      }))
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [statusTab, t],
  )

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CouponItem>(
    fetcher,
    PAGE_SIZE,
  )
  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新):走分页 hook 的 refresh
  useRefreshOnFocus(refresh)

  const onSelectTab = (tab: CouponStatus) => {
    const next = tab as CouponTab
    if (next === statusTab) return
    setStatusTab(next)
    setTimeout(refresh, 0)
  }

  return (
    <SharedCouponScreen
      t={t}
      items={items}
      activeTab={statusTab}
      onSelectTab={onSelectTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
