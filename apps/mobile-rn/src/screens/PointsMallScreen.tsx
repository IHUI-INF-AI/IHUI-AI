import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { PointsMallScreen as SharedPointsMallScreen, type PointsMallItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ProductPage {
  list: PointsMallItem[]
  total: number
  balance: number
}

const PAGE_SIZE = 20

export function PointsMallScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState(0)
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const fetcher = useCallback(
    async ({ page, pageSize }: { page: number; pageSize: number }) => {
      const res = await fetchApi<ProductPage>('/points-mall', {
        params: { page, pageSize },
      })
      if (!res.success) return { success: false as const, error: t('pointsMall.loadFailed') }
      const page0 = res.data
      const list = page0?.list ?? []
      if (typeof page0?.balance === 'number') setBalance(page0.balance)
      return { success: true as const, data: { list, total: page0?.total ?? list.length } }
    },
    [t],
  )

  const { items, loading, refreshing, error, refresh } = usePaginatedList<PointsMallItem>(fetcher, PAGE_SIZE)

  const onRedeem = async (item: PointsMallItem) => {
    if (balance < item.pointsCost) {
      Alert.alert(t('pointsMall.redeemFailed'), t('pointsMall.insufficient'))
      return
    }
    setRedeemingId(item.id)
    const res = await fetchApi<{ ok: boolean }>(`/points-mall/${item.id}/redeem`, { method: 'POST' })
    setRedeemingId(null)
    if (res.success) {
      Alert.alert(t('pointsMall.redeemSuccess'), `${item.name}`)
      refresh()
    } else {
      Alert.alert(t('pointsMall.redeemFailed'), t('pointsMall.redeemFailed'))
    }
  }

  return (
    <SharedPointsMallScreen
      t={t}
      items={items}
      balance={balance}
      redeemingId={redeemingId}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onRedeem={onRedeem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
