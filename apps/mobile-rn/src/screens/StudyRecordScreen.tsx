import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getStudyRecords, getStudyStatistics, type LearnRecord } from '@ihui/api-client'
import { StudyRecordScreen as SharedStudyRecordScreen } from '@ihui/rn-app'
import type { StudyRecordItem, StudyRecordStats } from '@ihui/types'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function mapRecord(r: LearnRecord): StudyRecordItem {
  return {
    id: r.id,
    courseTitle: r.courseTitle ?? null,
    lessonTitle: r.lessonTitle ?? null,
    status: r.status ?? 'in_progress',
    duration: r.duration,
    progress: r.progress,
    lastStudyAt: r.lastStudyAt ?? r.createdAt,
  }
}

export function StudyRecordScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [records, setRecords] = useState<StudyRecordItem[]>([])
  const [stats, setStats] = useState<StudyRecordStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      try {
        const [recordsRes, statsRes] = await Promise.all([
          getStudyRecords({ pageSize: 20 }),
          getStudyStatistics(),
        ])
        if (recordsRes.success) {
          setRecords((recordsRes.data.list ?? []).map(mapRecord))
        } else {
          setError(recordsRes.error || t('studyRecord.loadFailed'))
        }
        if (statsRes.success) {
          setStats(statsRes.data as StudyRecordStats)
        }
      } catch {
        setError(t('studyRecord.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedStudyRecordScreen
      t={t}
      records={records}
      stats={stats}
      userNickname={user?.nickname ?? user?.username ?? ''}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => load(true)}
      onBack={() => navigation.goBack()}
    />
  )
}
