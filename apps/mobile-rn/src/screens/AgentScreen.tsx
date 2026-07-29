import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgents, type Agent } from '@ihui/api-client'
import { AgentScreen as SharedAgentScreen, type AgentScreenItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function mapToItem(a: Agent): AgentScreenItem {
  return {
    id: a.id,
    name: a.name,
    avatar: a.avatar ?? undefined,
    description: a.description,
    isVipExclusive: a.isVipExclusive,
    useCount: a.useCount,
    rating: a.rating,
  }
}

export function AgentScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<AgentScreenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const res = await getAgents({ status: 'published', pageSize: 50 })
      if (res.success) setItems((res.data.list ?? []).map(mapToItem))
      else setError(res.error || t('agentScreen.loadFailed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentScreen.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <SharedAgentScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(id) => navigation.navigate('AgentDetail', { id })}
      onBack={() => navigation.goBack()}
    />
  )
}
