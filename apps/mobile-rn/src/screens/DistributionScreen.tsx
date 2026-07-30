import { useCallback, useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
} from '@ihui/rn-app'
import EarningsStatisticsCard from '../components/EarningsStatisticsCard'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function DistributionScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<DistributionInfo>('/distribution/overview')
      if (!res.success) {
        setError(t('distribution.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(res.data ?? null)
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleWithdraw = async () => {
    if (!info) return
    if (info.pending < info.withdrawMin) {
      Alert.alert(
        t('distribution.withdrawFailed'),
        t('distribution.withdrawMin', { amount: info.withdrawMin }),
      )
      return
    }
    setWithdrawing(true)
    const res = await fetchApi('/distribution/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: info.pending }),
    })
    setWithdrawing(false)
    if (res.success) {
      Alert.alert(t('distribution.withdrawSuccess'))
      void load(true)
    } else {
      Alert.alert(t('distribution.withdrawFailed'))
    }
  }

  return (
    <View style={shellStyles.root}>
      <View style={shellStyles.statsWrap}>
        <EarningsStatisticsCard
          label="分销收益概览"
          title={info?.totalEarnings ?? 0}
          todayAmount={info?.pending ?? 0}
          monthAmount={info?.withdrawn ?? 0}
          totalAmount={info?.totalEarnings ?? 0}
          trend={info ? { direction: 'up', percent: 12.5 } : undefined}
        />
      </View>
      <SharedDistributionScreen
        t={t}
        info={info}
        loading={loading}
        refreshing={refreshing}
        error={error}
        withdrawing={withdrawing}
        onRefresh={() => void load(true)}
        onWithdraw={handleWithdraw}
        onBack={() => navigation.goBack()}
      />
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  statsWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 } as const,
}
