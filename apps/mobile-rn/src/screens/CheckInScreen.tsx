import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CheckInScreen as SharedCheckInScreen, type CheckInInfo } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function CheckInScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<CheckInInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const res = await fetchApi<CheckInInfo>('/checkin/today')
        if (!res.success) throw new Error()
        setInfo(res.data ?? null)
      } catch {
        setError(t('checkIn.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleSign = async () => {
    if (!info || info.todaySigned) return
    setSigning(true)
    const res = await fetchApi('/checkin', { method: 'POST' })
    setSigning(false)
    if (res.success) {
      Alert.alert(t('checkIn.signSuccess'), `+${info.todayReward}`)
      void load(true)
    } else {
      Alert.alert(t('checkIn.signFailed'))
    }
  }

  return (
    <SharedCheckInScreen
      t={t}
      info={info}
      loading={loading}
      refreshing={refreshing}
      signing={signing}
      error={error}
      onSign={handleSign}
      onRefresh={() => load(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
