import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { HistoryScreen as SharedHistoryScreen } from '@ihui/rn-app'
import type { HistoryItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function HistoryScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<HistoryItem[]>('/api/history')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('history.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onPressItem = (item: HistoryItem) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article')
      navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
    else if (item.targetType === 'live') navigation.navigate('LiveDetail', { id: item.targetId })
  }

  return (
    <SharedHistoryScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={onPressItem}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
