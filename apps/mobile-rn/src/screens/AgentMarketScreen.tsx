import { useEffect, useState } from 'react'
import { FlatList, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card, Input, Loading } from '@ihui/ui-native'

interface Agent { id: string; name: string; description: string; category: string; uses: number; rating: number; isFree: boolean }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function AgentMarketScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = async (kw: string) => {
    setLoading(true)
    setError('')
    const url = kw ? `/api/agents?keyword=${encodeURIComponent(kw)}` : '/api/agents'
    const res = await fetchApi<Agent[]>(url)
    if (res.success) setAgents(res.data ?? [])
    else if (!res.success) setError(res.error || t('agentMarket.loadFailed'))
    setLoading(false)
  }

  useEffect(() => { void load('') }, [])

  if (loading && agents.length === 0) return <View className="flex-1 items-center justify-center bg-card p-4"><Loading /><Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text></View>
  if (error && agents.length === 0) return (
    <View className="flex-1 items-center justify-center bg-card p-4">
      <Text className="mb-2 text-center text-[13px] text-destructive">{error}</Text>
      <TouchableOpacity className="rounded-lg bg-primary px-4 py-2" onPress={() => navigation.goBack()}><Text className="text-sm text-primary-foreground">{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}><Text className="text-sm text-muted-foreground">{t('common.back')}</Text></TouchableOpacity>
      <Text className="mb-3 mt-2 text-[22px] font-semibold text-foreground">{t('agentMarket.title')}</Text>
      <View className="mb-3 flex-row items-center gap-2">
        <Input className="flex-1" value={keyword} onChangeText={setKeyword} placeholder={t('agentMarket.searchPlaceholder')} onSubmitEditing={() => load(keyword)} returnKeyType="search" />
        <TouchableOpacity className="rounded-lg bg-primary px-3.5 py-2" onPress={() => load(keyword)}><Text className="text-sm text-primary-foreground">{t('common.search')}</Text></TouchableOpacity>
      </View>
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<View className="items-center py-10"><Text className="text-[13px] text-muted-foreground">{t('agentMarket.empty')}</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('AgentDetail', { id: item.id })}>
            <Card className="mb-2 p-3">
              <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>{item.name}</Text>
              <Text className="mt-1 text-[13px] text-foreground" numberOfLines={2}>{item.description}</Text>
              <View className="mt-1.5 flex-row items-center gap-2">
                <Text className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">{item.category}</Text>
                <Text className="text-[11px] text-muted-foreground">★ {item.rating.toFixed(1)} · {item.uses}{t('agentMarket.uses')}</Text>
                <Text className="ml-auto text-xs font-semibold text-primary">{item.isFree ? t('agentMarket.free') : t('agentMarket.paid')}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
