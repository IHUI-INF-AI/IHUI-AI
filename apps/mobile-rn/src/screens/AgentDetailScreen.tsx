import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Card, Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface AgentDetail {
  id: string
  name: string
  description: string
  avatar?: string
  uses: number
  rating: number
  category: string
  creator: string
  isFree: boolean
  price: number
}

type Route = RouteProp<RootStackParamList, 'AgentDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<AgentDetail>(`/api/agents/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setAgent(res.data)
      else setError(res.error || t('agentDetail.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, t])

  if (loading) return <View className="flex-1 items-center justify-center bg-card p-4"><Loading /><Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text></View>
  if (error || !agent) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error || t('agentDetail.loadFailed')}</Text>
      <TouchableOpacity className="rounded-lg bg-primary px-4 py-2" onPress={() => navigation.goBack()}><Text className="text-sm text-primary-foreground">{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <ScrollView className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text className="text-sm text-muted-foreground">{t('common.back')}</Text></TouchableOpacity>
      <View className="mb-3 mt-2">
        <Text className="text-[22px] font-semibold text-foreground">{agent.name}</Text>
        <Text className="mt-1 text-xs text-primary">{agent.category}</Text>
      </View>
      <Card>
        <Text className="mt-2 text-[11px] text-muted-foreground">{t('agentDetail.description')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{agent.description || '—'}</Text>
        <Text className="mt-2 text-[11px] text-muted-foreground">{t('agentDetail.creator')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{agent.creator}</Text>
        <Text className="mt-2 text-[11px] text-muted-foreground">{t('agentDetail.uses')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">{agent.uses}</Text>
        <Text className="mt-2 text-[11px] text-muted-foreground">{t('agentDetail.rating')}</Text>
        <Text className="mt-0.5 text-sm text-foreground">★ {agent.rating.toFixed(1)}</Text>
        <Text className="mt-2 text-[11px] text-muted-foreground">{t('agentDetail.price')}</Text>
        <Text className="mt-0.5 text-lg font-semibold text-primary">{agent.isFree ? t('agentDetail.free') : `¥${agent.price.toFixed(2)}`}</Text>
      </Card>
      <TouchableOpacity className="mt-4 items-center rounded-lg bg-primary py-3" onPress={() => navigation.navigate('AgentChat', { agentId: agent.id, name: agent.name })}>
        <Text className="text-[15px] font-semibold text-primary-foreground">{t('agentDetail.startChat')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
