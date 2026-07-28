import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
interface Question {
  id: string
  type: 'single' | 'multi'
  content: string
  options: string[]
}
interface Exam {
  id: string
  title: string
  questions: Question[]
  duration: number
}

type Route = RouteProp<RootStackParamList, 'ExamQuestion'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function ExamQuestionScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { examId } = route.params
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Exam>(`/api/exam/papers/${encodeURIComponent(examId)}`)
      if (cancelled) return
      if (res.success) setExam(res.data)
      else setError(res.error || t('examQuestion.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [examId, t])

  const toggleOption = (qId: string, optIdx: number, multi: boolean) => {
    setAnswers((prev) => {
      const cur = prev[qId] ?? []
      if (multi)
        return {
          ...prev,
          [qId]: cur.includes(optIdx) ? cur.filter((i) => i !== optIdx) : [...cur, optIdx],
        }
      return { ...prev, [qId]: [optIdx] }
    })
  }

  const onSubmit = async () => {
    const res = await fetchApi<{ id: string }>(
      `/api/exam/papers/${encodeURIComponent(examId)}/submit-answers`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    )
    if (res.success && res.data) navigation.replace('ExamResult', { id: res.data.id })
    else if (!res.success) setError(res.error || t('examQuestion.submitFailed'))
  }

  if (loading)
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error || !exam)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('examQuestion.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  const q = exam.questions[current]
  if (!q)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('examQuestion.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  const selected = answers[q.id] ?? []
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {exam.title}
        </Text>
      </View>
      <Text style={styles.progress}>
        {current + 1}/{exam.questions.length}
      </Text>
      <Text style={styles.qType}>
        {q.type === 'multi' ? t('examQuestion.multi') : t('examQuestion.single')}
      </Text>
      <Text style={styles.qContent}>{q.content}</Text>
      {q.options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.option, selected.includes(idx) && styles.optionSelected]}
          onPress={() => toggleOption(q.id, idx, q.type === 'multi')}
        >
          <Text style={[styles.optionText, selected.includes(idx) && styles.optionTextSelected]}>
            {String.fromCharCode(65 + idx)}. {opt}
          </Text>
        </TouchableOpacity>
      ))}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.navBtn, current === 0 && styles.navDisabled]}
          onPress={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
        >
          <Text style={styles.navText}>{t('examQuestion.prev')}</Text>
        </TouchableOpacity>
        {current < exam.questions.length - 1 ? (
          <TouchableOpacity style={styles.navBtn} onPress={() => setCurrent(current + 1)}>
            <Text style={styles.navText}>{t('examQuestion.next')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
            <Text style={styles.submitText}>{t('examQuestion.submit')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  progress: { marginTop: 12, fontSize: 12, color: tokens.success.DEFAULT, fontWeight: '600' },
  qType: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  qContent: { marginTop: 8, fontSize: 16, fontWeight: '500', color: tokens.text.primary, marginBottom: 16 },
  option: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  optionSelected: { borderColor: tokens.success.DEFAULT, backgroundColor: tokens.success.light },
  optionText: { fontSize: 14, color: tokens.text.medium },
  optionTextSelected: { color: tokens.success.DEFAULT, fontWeight: '500' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 16 },
  navBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
  },
  navDisabled: { opacity: 0.4 },
  navText: { fontSize: 14, color: tokens.text.medium },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
    alignItems: 'center',
  },
  submitText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
