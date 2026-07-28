import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { FeedbackHistoryScreen as SharedFeedbackHistoryScreen } from '@ihui/rn-app'
import type { FeedbackHistoryItem } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function FeedbackHistoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<FeedbackHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<FeedbackHistoryItem[]>('/feedbacks')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('feedbackHistory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedFeedbackHistoryScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(id) => navigation.navigate('FeedbackDetail', { id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}