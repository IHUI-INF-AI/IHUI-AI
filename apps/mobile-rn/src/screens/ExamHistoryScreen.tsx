import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { ExamHistoryScreen as SharedExamHistoryScreen, type ExamHistoryItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamHistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [history, setHistory] = useState<ExamHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<ExamHistoryItem[]>('/api/exam/records')
    if (res.success) setHistory(res.data ?? [])
    else setError(res.error || t('examHistory.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <SharedExamHistoryScreen
      t={t}
      items={history}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onPressItem={(id) => navigation.navigate('ExamResult', { id })}
      onBack={() => navigation.goBack()}
    />
  )
}
