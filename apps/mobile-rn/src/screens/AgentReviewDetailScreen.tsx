import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'AgentReviewDetail'>
interface Detail { id: string; agentName: string; author: string; rating: number; content: string; createdAt: string }

export function AgentReviewDetailScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/agent-reviews/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Detail }
      setItem(d.data ?? null)
    } catch { setError(t('agentReviewDetail.loadFailed')) } finally { setLoading(false) }
  }, [id, token, t])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return <View className="flex-1 items-center justify-center p-4"><Loading /><Text className="mt-2 text-xs text-muted-foreground">{t('common.loading')}</Text></View>
  }
  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-center text-[13px] text-destructive">{error || t('agentReviewDetail.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-3"><Text className="text-sm text-foreground">{t('common.back')}</Text></TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()}><Text className="text-sm text-foreground">{t('common.back')}</Text></TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('agentReviewDetail.title')}</Text>
      </View>
      <View className="p-4">
        <Text className="text-base font-semibold text-primary">{item.agentName}</Text>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-xs text-muted-foreground">{t('agentReviewDetail.author')}: {item.author}</Text>
          <Text className="text-xs text-amber-500">{'★'.repeat(Math.max(1, Math.min(5, item.rating || 0)))}</Text>
        </View>
        <Text className="mt-3 text-sm leading-[22px] text-foreground">{item.content}</Text>
        <Text className="mt-3 text-[11px] text-muted-foreground">{item.createdAt}</Text>
      </View>
    </ScrollView>
  )
}
