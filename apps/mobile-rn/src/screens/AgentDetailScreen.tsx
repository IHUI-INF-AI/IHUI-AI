import { useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentDetailScreen as SharedAgentDetailScreen, type AgentDetailItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'AgentDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [agent, setAgent] = useState<AgentDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AgentDetailItem>(`/api/agents/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setAgent(res.data)
      else setError(res.error || t('agentDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  return (
    <SharedAgentDetailScreen
      t={t}
      item={agent}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
      onStartChat={(agentId, name) => navigation.navigate('AgentChat', { agentId, name })}
    />
  )
}
