import { useCallback, useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'FeedbackDetail'>
interface Detail {
  id: string
  type: string
  content: string
  status: string
  reply: string
  createdAt: string
}

export function FeedbackDetailScreen() {
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
      const r = await fetch(`${API_BASE_URL}/api/feedbacks/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Detail }
      setItem(d.data ?? null)
    } catch {
      setError(t('feedbackDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, token, t])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Loading />
        <Text className="mt-2 text-xs text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-[13px] text-[#DC2626] text-center">{error || t('feedbackDetail.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-3">
          <Text className="text-sm text-[#374151]">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-card">
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-[#374151]">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('feedbackDetail.title')}</Text>
      </View>
      <View className="p-4">
        <View className="flex-row gap-2 mb-3">
          <Text className="text-[11px] text-primary-foreground bg-primary px-2 py-0.5 rounded-lg">{item.type}</Text>
          <Text className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">{item.status}</Text>
        </View>
        <Text className="mt-3 text-[13px] font-semibold text-muted-foreground">{t('feedbackDetail.content')}</Text>
        <Text className="mt-1.5 text-sm text-[#374151] leading-[22px]">{item.content}</Text>
        <Text className="mt-2 text-[11px] text-[#9CA3AF]">{item.createdAt}</Text>
        <Text className="mt-3 text-[13px] font-semibold text-muted-foreground">{t('feedbackDetail.reply')}</Text>
        <Text className={`mt-1.5 text-sm leading-[22px] ${item.reply ? 'text-[#374151]' : 'text-[#9CA3AF] italic'}`}>
          {item.reply || t('common.empty')}
        </Text>
      </View>
    </ScrollView>
  )
}
