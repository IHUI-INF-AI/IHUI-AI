import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Loading } from '@ihui/ui-native'
interface ExamHistory {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  submittedAt: string
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamHistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [history, setHistory] = useState<ExamHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<ExamHistory[]>('/api/exam/records')
    if (res.success) setHistory(res.data ?? [])
    else setError(res.error || t('examHistory.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  if (error && history.length === 0)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="text-[13px] text-[#DC2626] mb-2 text-center">{error}</Text>
        <TouchableOpacity className="mt-3 px-4 py-2 rounded-lg bg-primary" onPress={() => navigation.goBack()}>
          <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <View className="flex-1 bg-card px-4 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mt-2 text-[22px] font-semibold text-foreground mb-3">{t('examHistory.title')}</Text>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View className="py-10 items-center">
            <Text className="text-[13px] text-muted-foreground">{t('examHistory.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ExamResult', { id: item.id })}
          >
            <Card className="p-3 mb-2">
              <View className="flex-row justify-between items-center">
                <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                  {item.examTitle}
                </Text>
                <Text
                  className={`text-[11px] px-1.5 py-0.5 rounded ml-2 ${item.passed ? 'text-primary bg-[#ECFDF5]' : 'text-[#DC2626] bg-[#FEF2F2]'}`}
                >
                  {item.passed ? t('examHistory.passed') : t('examHistory.failed')}
                </Text>
              </View>
              <View className="flex-row justify-between mt-1.5">
                <Text className="text-[13px] text-primary font-semibold">
                  {item.score}/{item.totalScore}
                </Text>
                <Text className="text-[11px] text-[#9CA3AF]">{item.submittedAt}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
