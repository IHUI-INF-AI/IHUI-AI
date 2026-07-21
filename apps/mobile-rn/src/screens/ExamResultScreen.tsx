import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

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
const PRIMARY = '#10B981'

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
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error || !result)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('examResult.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{result.examTitle}</Text>
      <View style={[styles.scoreCard, result.passed && styles.passedCard]}>
        <Text style={styles.scoreValue}>
          {result.score}/{result.totalScore}
        </Text>
        <Text style={[styles.passedLabel, result.passed ? styles.passed : styles.failed]}>
          {result.passed ? t('examResult.passed') : t('examResult.failed')}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.stat}>
          {t('examResult.correct', { count: result.correctCount, total: result.totalCount })}
        </Text>
        <Text style={styles.stat}>{t('examResult.duration', { min: result.duration })}</Text>
      </View>
      <Text style={styles.meta}>{result.submittedAt}</Text>
      {result.wrongQuestions.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{t('examResult.wrongQuestions')}</Text>
          {result.wrongQuestions.map((q) => (
            <View key={q.index} style={styles.card}>
              <Text style={styles.qIdx}>
                {q.index + 1}. {q.question}
              </Text>
              <Text style={styles.wrongAns}>
                {t('examResult.yourAnswer')}:{q.yourAnswer}
              </Text>
              <Text style={styles.correctAns}>
                {t('examResult.correctAnswer')}:{q.correctAnswer}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  scoreCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    marginBottom: 12,
  },
  passedCard: { borderColor: PRIMARY, backgroundColor: '#ecfdf5' },
  scoreValue: { fontSize: 32, fontWeight: '600', color: '#111827' },
  passedLabel: { marginTop: 4, fontSize: 14, fontWeight: '600' },
  passed: { color: PRIMARY },
  failed: { color: '#dc2626' },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  stat: {
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  meta: { fontSize: 11, color: '#9ca3af', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  qIdx: { fontSize: 13, fontWeight: '500', color: '#111827' },
  wrongAns: { marginTop: 6, fontSize: 12, color: '#dc2626' },
  correctAns: { marginTop: 2, fontSize: 12, color: PRIMARY },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  btnText: { color: '#fff', fontSize: 14 },
})
