import { useEffect, useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Loading } from '@ihui/ui-native'
interface ExamResult {
  id: string
  examTitle: string
  score: number
  totalScore: number
  passed: boolean
  correctCount: number
  totalCount: number
  duration: number
  submittedAt: string
  wrongQuestions: Array<{
    index: number
    question: string
    yourAnswer: string
    correctAnswer: string
  }>
}

type Route = RouteProp<RootStackParamList, 'ExamResult'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamResultScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [result, setResult] = useState<ExamResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<ExamResult>(`/api/exam/records/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setResult(res.data)
      else setError(res.error || t('examResult.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  if (error || !result)
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="text-[13px] text-[#DC2626] mb-2 text-center">{error || t('examResult.loadFailed')}</Text>
        <TouchableOpacity className="mt-3 px-4 py-2 rounded-lg bg-primary" onPress={() => navigation.goBack()}>
          <Text className="text-sm text-primary-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <ScrollView className="flex-1 bg-card px-4 pt-12 pb-8">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
      </TouchableOpacity>
      <Text className="mt-2 text-[22px] font-semibold text-foreground mb-3">{result.examTitle}</Text>
      <View
        className={`p-4 rounded-lg border items-center mb-3 ${result.passed ? 'border-primary bg-[#ECFDF5]' : 'border-border'}`}
      >
        <Text className="text-[32px] font-semibold text-foreground">
          {result.score}/{result.totalScore}
        </Text>
        <Text className={`mt-1 text-sm font-semibold ${result.passed ? 'text-primary' : 'text-[#DC2626]'}`}>
          {result.passed ? t('examResult.passed') : t('examResult.failed')}
        </Text>
      </View>
      <View className="flex-row gap-3 mb-1">
        <Text className="text-xs text-[#374151] bg-muted px-2.5 py-1 rounded-lg">
          {t('examResult.correct', { count: result.correctCount, total: result.totalCount })}
        </Text>
        <Text className="text-xs text-[#374151] bg-muted px-2.5 py-1 rounded-lg">
          {t('examResult.duration', { min: result.duration })}
        </Text>
      </View>
      <Text className="text-[11px] text-[#9CA3AF] mb-4">{result.submittedAt}</Text>
      {result.wrongQuestions.length > 0 ? (
        <>
          <Text className="text-base font-semibold text-foreground mb-2">{t('examResult.wrongQuestions')}</Text>
          {result.wrongQuestions.map((q) => (
            <Card key={q.index} className="p-3 mb-2">
              <Text className="text-[13px] font-medium text-foreground">
                {q.index + 1}. {q.question}
              </Text>
              <Text className="mt-1.5 text-xs text-[#DC2626]">
                {t('examResult.yourAnswer')}:{q.yourAnswer}
              </Text>
              <Text className="mt-0.5 text-xs text-primary">
                {t('examResult.correctAnswer')}:{q.correctAnswer}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}
