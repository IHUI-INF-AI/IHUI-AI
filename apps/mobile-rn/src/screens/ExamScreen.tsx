import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getExams, type Exam } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

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
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && exams.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('exam.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('exam.title')}</Text>
        <Text style={styles.subtitle}>{t('exam.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        style={styles.list}
        data={exams}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('exam.empty')}</Text>
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
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    status === 'inProgress' && styles.statusBadgeActive,
                    status === 'ended' && styles.statusBadgeEnded,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      status === 'inProgress' && styles.statusBadgeTextActive,
                    ]}
                  >
                    {t(statusKey)}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('exam.duration')}:{item.duration}m
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('exam.totalScore')}:{item.totalScore}
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('exam.passScore')}:{item.passScore}
                </Text>
              </View>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('exam.questions')}:{item.questionCount}
                </Text>
                <Text style={styles.cardMetaText}>
                  {t('exam.attempts')}:{item.attemptCount}/{item.maxAttempts || '∞'}
                </Text>
              </View>
              {item.startTime ? (
                <Text style={styles.cardMeta}>
                  {t('exam.start')}:{formatDateTime(item.startTime)}
                </Text>
              ) : null}
              {item.endTime ? (
                <Text style={styles.cardMeta}>
                  {t('exam.end')}:{formatDateTime(item.endTime)}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
                  onPress={() => handleStart(item)}
                  disabled={!canStart}
                >
                  <Text style={styles.startBtnText}>{t('exam.startExam')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingHorizontal: 16 },
  loadingText: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backText: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6b7280' },
  userText: { marginTop: 4, fontSize: 11, color: '#9ca3af' },
  toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: PRIMARY },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#dc2626' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  cardDesc: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#f3f4f6' },
  statusBadgeActive: { backgroundColor: '#d1fae5' },
  statusBadgeEnded: { backgroundColor: '#fef2f2' },
  statusBadgeText: { fontSize: 11, color: '#6b7280' },
  statusBadgeTextActive: { color: PRIMARY },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  cardMetaText: { fontSize: 12, color: '#6b7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  startBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  startBtnDisabled: { backgroundColor: '#d1d5db' },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryText: { color: '#fff', fontSize: 14 },
})
