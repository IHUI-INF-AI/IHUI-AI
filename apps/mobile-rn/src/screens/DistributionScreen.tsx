import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
} from '@ihui/rn-app'
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
  )
}
