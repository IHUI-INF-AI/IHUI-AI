import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getExams, type Exam } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Loading } from '@ihui/ui-native'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function getExamStatus(exam: Exam, now: number): 'notStarted' | 'inProgress' | 'ended' {
  if (exam.endTime) {
    const endMs = new Date(exam.endTime).getTime()
    if (endMs < now) return 'ended'
  }
  if (exam.startTime) {
    const startMs = new Date(exam.startTime).getTime()
    if (startMs > now) return 'notStarted'
  }
  return 'inProgress'
}

export function ExamScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getExams({ pageSize: 20 })
      if (res.success) {
        setExams(res.data.list ?? [])
      } else {
        setError(res.error || t('exam.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleStart = (exam: Exam) => {
    const status = getExamStatus(exam, Date.now())
    if (status === 'ended') {
      setToast(t('exam.ended'))
      return
    }
    if (status === 'notStarted') {
      setToast(t('exam.notStarted'))
      return
    }
    if (exam.attemptCount >= exam.maxAttempts && exam.maxAttempts > 0) {
      setToast(t('exam.noAttemptsLeft'))
      return
    }
    setToast(t('exam.startHint', { title: exam.title }))
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-4">
        <Loading />
        <Text className="mt-2 text-[13px] text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && exams.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-card px-4">
        <Text className="px-4 py-1 text-xs text-[#DC2626]">{error}</Text>
        <TouchableOpacity className="mt-3 px-4 py-2 rounded-lg bg-primary" onPress={() => load()}>
          <Text className="text-sm text-primary-foreground">{t('exam.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-card">
      <View className="px-4 pt-12 pb-2">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="mt-2 text-[22px] font-semibold text-foreground">{t('exam.title')}</Text>
        <Text className="mt-1 text-[13px] text-muted-foreground">{t('exam.subtitle')}</Text>
        <Text className="mt-1 text-[11px] text-[#9CA3AF]">{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      {toast ? <Text className="px-4 py-1 text-xs text-primary">{toast}</Text> : null}
      {error ? <Text className="px-4 py-1 text-xs text-[#DC2626]">{error}</Text> : null}

      <FlatList
        className="flex-1 px-4"
        data={exams}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="py-10 items-center">
            <Text className="text-[13px] text-[#9CA3AF]">{t('exam.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = getExamStatus(item, Date.now())
          const statusKey =
            status === 'ended'
              ? 'exam.ended'
              : status === 'notStarted'
                ? 'exam.notStarted'
                : 'exam.inProgress'
          const canStart =
            status === 'inProgress' &&
            (item.maxAttempts === 0 || item.attemptCount < item.maxAttempts)
          return (
            <Card className="p-3 mb-2.5">
              <View className="flex-row justify-between items-start">
                <Text className="flex-1 text-[15px] font-semibold text-foreground mr-2" numberOfLines={2}>
                  {item.title}
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-lg ${status === 'inProgress' ? 'bg-[#D1FAE5]' : status === 'ended' ? 'bg-[#FEF2F2]' : 'bg-muted'}`}
                >
                  <Text className={`text-[11px] ${status === 'inProgress' ? 'text-primary' : 'text-muted-foreground'}`}>
                    {t(statusKey)}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View className="flex-row gap-3 mt-1 flex-wrap">
                <Text className="text-xs text-muted-foreground">
                  {t('exam.duration')}:{item.duration}m
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t('exam.totalScore')}:{item.totalScore}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t('exam.passScore')}:{item.passScore}
                </Text>
              </View>
              <View className="flex-row gap-3 mt-1 flex-wrap">
                <Text className="text-xs text-muted-foreground">
                  {t('exam.questions')}:{item.questionCount}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t('exam.attempts')}:{item.attemptCount}/{item.maxAttempts || '∞'}
                </Text>
              </View>
              {item.startTime ? (
                <Text className="mt-1 text-xs text-muted-foreground">
                  {t('exam.start')}:{formatDateTime(item.startTime)}
                </Text>
              ) : null}
              {item.endTime ? (
                <Text className="mt-1 text-xs text-muted-foreground">
                  {t('exam.end')}:{formatDateTime(item.endTime)}
                </Text>
              ) : null}
              <View className="flex-row justify-end mt-2.5">
                <TouchableOpacity
                  className={`px-4 py-2 rounded-lg ${canStart ? 'bg-primary' : 'bg-[#D1D5DB]'}`}
                  onPress={() => handleStart(item)}
                  disabled={!canStart}
                >
                  <Text className="text-[13px] text-primary-foreground font-semibold">{t('exam.startExam')}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )
        }}
      />
    </View>
  )
}
