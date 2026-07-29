import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { HelpScreen as SharedHelpScreen, type HelpListItem } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function HelpScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HelpListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<HelpListItem[]>('/help/articles')
      if (!res.success) throw new Error('http')
      setItems(res.data ?? [])
    } catch {
      setError(t('help.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  const onToggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <SharedHelpScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      expandedId={expandedId}
      onRefresh={onRefresh}
      onToggle={onToggle}
      onBack={() => navigation.goBack()}
    />
  )
}
