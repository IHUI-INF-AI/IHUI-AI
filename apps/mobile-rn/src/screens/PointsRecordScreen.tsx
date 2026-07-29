import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  PointsRecordScreen as SharedPointsRecordScreen,
  type PointsRecordItem,
  type PointsRecordType,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface RecordPage {
  list: PointsRecordItem[]
  total: number
  balance: number
}

const PAGE_SIZE = 20

export function PointsRecordScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [typeTab, setTypeTab] = useState<PointsRecordType>('all')
  const [balance, setBalance] = useState(0)

  const fetcher = useCallback(async () => {
    const res = await fetchApi<RecordPage>('/points/records', {
      params: { page: 1, pageSize: PAGE_SIZE, type: typeTab },
    })
    if (!res.success) return { success: false as const, error: t('pointsRecord.loadFailed') }
    const page = res.data
    const list = page?.list ?? []
    if (typeof page?.balance === 'number') setBalance(page.balance)
    return { success: true as const, data: { list, total: page?.total ?? list.length } }
  }, [typeTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<PointsRecordItem>(
    fetcher,
    PAGE_SIZE,
  )

  const onSelectTab = (next: PointsRecordType) => {
    if (next === typeTab) return
    setTypeTab(next)
    setTimeout(refresh, 0)
  }

  return (
    <SharedPointsRecordScreen
      t={t}
      items={items}
      balance={balance}
      activeTab={typeTab}
      onSelectTab={onSelectTab}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
    />
  )
}
