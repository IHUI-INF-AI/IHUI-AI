import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AskListScreen as SharedAskListScreen, type AskListItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AskListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [asks, setAsks] = useState<AskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<AskListItem[]>('/api/asks')
    if (res.success) setAsks(res.data ?? [])
    else setError(res.error || t('askList.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SharedAskListScreen
      t={t}
      items={asks}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onPressItem={(id) => navigation.navigate('AskDetail', { id })}
      onCreate={() => navigation.navigate('AskCreate')}
      onBack={() => navigation.goBack()}
    />
  )
}
