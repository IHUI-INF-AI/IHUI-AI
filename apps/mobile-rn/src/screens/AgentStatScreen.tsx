import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentStatScreen as SharedAgentStatScreen, type AgentStatItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function AgentStatScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [stat, setStat] = useState<AgentStatItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<AgentStatItem>('/agent-stat')
      if (!res.success) throw new Error()
      setStat(res.data ?? null)
    } catch {
      setError(t('agentStat.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedAgentStatScreen
      t={t}
      stat={stat}
      loading={loading}
      error={error}
      onBack={() => navigation.goBack()}
    />
  )
}
