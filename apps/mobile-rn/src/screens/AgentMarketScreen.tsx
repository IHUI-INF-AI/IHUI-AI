import { useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { AgentMarketScreen as SharedAgentMarketScreen, type AgentMarketItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentMarketScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [agents, setAgents] = useState<AgentMarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = async (kw: string) => {
    setLoading(true)
    setError('')
    const url = kw ? `/api/agents?keyword=${encodeURIComponent(kw)}` : '/api/agents'
    const res = await fetchApi<AgentMarketItem[]>(url)
    if (res.success) setAgents(res.data ?? [])
    else setError(res.error || t('agentMarket.loadFailed'))
    setLoading(false)
  }

  useEffect(() => {
    void load('')
  }, [])

  return (
    <SharedAgentMarketScreen
      t={t}
      items={agents}
      keyword={keyword}
      loading={loading}
      error={error}
      onKeywordChange={setKeyword}
      onSearch={() => load(keyword)}
      onPressItem={(id) => navigation.navigate('AgentDetail', { id })}
      onBack={() => navigation.goBack()}
    />
  )
}
