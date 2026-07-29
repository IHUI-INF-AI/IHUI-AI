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
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CouponPage {
  list: Array<{
    id: string
    name: string
    amount: number
    minSpend: number
    validUntil: string
    status: 'available' | 'used' | 'expired'
  }>
  total: number
}

const PAGE_SIZE = 20

export function CouponScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [statusTab, setStatusTab] = useState<CouponStatus>('available')

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<CouponPage>('/coupons', {
        params: { page, pageSize, status: statusTab },
      })
      if (!res.success) return { success: false as const, error: t('coupon.loadFailed') }
      const list: CouponItem[] = (res.data?.list ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        minSpend: c.minSpend,
        validUntil: formatDateOnly(c.validUntil),
        status: c.status,
      }))
      return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
    },
    [statusTab, t],
  )

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CouponItem>(
    fetcher,
    PAGE_SIZE,
  )

  const onSelectTab = (tab: CouponStatus) => {
    if (tab === statusTab) return
    setStatusTab(tab)
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
