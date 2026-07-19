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
import {
  getStudyRecords,
  getStudyStatistics,
  type LearnRecord,
} from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface StudyStats {
  totalDuration: number
  totalCourses: number
  completedCourses: number
  totalLessons: number
  completedLessons: number
  continuousDays: number
}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function statusKey(status: LearnRecord['status']): string {
  if (status === 'completed') return 'studyRecord.statusCompleted'
  if (status === 'paused') return 'studyRecord.statusPaused'
  return 'studyRecord.statusInProgress'
}

export function StudyRecordScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [records, setRecords] = useState<LearnRecord[]>([])
  const [stats, setStats] = useState<StudyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [recordsRes, statsRes] = await Promise.all([
        getStudyRecords({ pageSize: 20 }),
        getStudyStatistics(),
      ])
      if (recordsRes.success) {
        setRecords(recordsRes.data.list ?? [])
      } else {
        setError(recordsRes.error || t('studyRecord.loadFailed'))
      }
      if (statsRes.success) {
        setStats(statsRes.data as StudyStats)
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && records.length === 0 && !stats) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('common.back')}</Text>
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
        <Text style={styles.title}>{t('studyRecord.title')}</Text>
        <Text style={styles.subtitle}>{t('studyRecord.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      {stats ? (
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(stats.totalDuration)}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.totalDuration')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalCourses}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.totalCourses')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedCourses}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.completedCourses')}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.completedLessons}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.completedLessons')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalLessons}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.totalLessons')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.continuousDays}</Text>
              <Text style={styles.statLabel}>{t('studyRecord.continuousDays')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.sectionTitle}>{t('studyRecord.recentRecords')}</Text>

      <FlatList
        style={styles.list}
        data={records}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('studyRecord.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.courseTitle ?? item.lessonTitle ?? '—'}
              </Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{t(statusKey(item.status))}</Text>
              </View>
            </View>
            {item.lessonTitle ? (
              <Text style={styles.cardMeta}>
                {t('studyRecord.lessonTitle')}:{item.lessonTitle}
              </Text>
            ) : null}
            <View style={styles.cardMetaRow}>
              {item.duration ? (
                <Text style={styles.cardMetaText}>
                  {t('studyRecord.duration')}:{formatDuration(item.duration)}
                </Text>
              ) : null}
              {item.progress !== undefined ? (
                <Text style={styles.cardMetaText}>
                  {t('studyRecord.progress')}:{item.progress}%
                </Text>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {t('studyRecord.lastStudyAt')}:{formatDateTime(item.lastStudyAt)}
            </Text>
          </View>
        )}
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
  statsCard: { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 8, backgroundColor: '#ecfdf5' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '600', color: PRIMARY },
  statLabel: { marginTop: 2, fontSize: 11, color: '#6b7280', textAlign: 'center' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, fontSize: 15, fontWeight: '600', color: '#111827' },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#dc2626' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#f3f4f6' },
  statusBadgeText: { fontSize: 11, color: '#6b7280' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: '#6b7280' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryText: { color: '#fff', fontSize: 14 },
})
