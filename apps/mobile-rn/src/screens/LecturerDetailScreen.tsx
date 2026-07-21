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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'LecturerDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface LecturerInfo {
  id: string
  nickname: string
  avatar: string | null
  bio: string
  followers: number
  following: number
  isFollowing: boolean
  courseCount: number
  studentCount: number
}

interface LecturerCourse {
  id: string
  title: string
  level: string
  price: number
  studentCount: number
}

export function LecturerDetailScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<Route>()
  const lecturerId = route.params.id

  const [info, setInfo] = useState<LecturerInfo | null>(null)
  const [courses, setCourses] = useState<LecturerCourse[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [followLoading, setFollowLoading] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const [infoRes, coursesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/live/lecturers/${lecturerId}`, { headers } as RequestInit),
        fetch(`${API_BASE_URL}/api/lecturers/${lecturerId}/courses?page=1&pageSize=20`, {
          headers,
        } as RequestInit),
      ])
      if (!infoRes.ok || !coursesRes.ok) {
        setError(t('lecturerDetail.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      const infoData = (await infoRes.json()) as { data?: LecturerInfo }
      const coursesData = (await coursesRes.json()) as { data?: { list: LecturerCourse[] } }
      setInfo(infoData.data ?? null)
      setCourses(coursesData.data?.list ?? [])
      setLoading(false)
      setRefreshing(false)
    },
    [token, lecturerId, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleFollow = async () => {
    if (!info) return
    setFollowLoading(true)
    const resp = await fetch(`${API_BASE_URL}/api/follows/${info.id}`, {
      method: info.isFollowing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    setFollowLoading(false)
    if (resp.ok) {
      setInfo({
        ...info,
        isFollowing: !info.isFollowing,
        followers: info.followers + (info.isFollowing ? -1 : 1),
      })
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.emptyText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryBtnText}>{t('lecturerDetail.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <FlatList
      data={courses}
      keyExtractor={(item) => item.id}
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('lecturerDetail.title')}</Text>
            <Text style={styles.subtitle}>{t('lecturerDetail.subtitle')}</Text>
          </View>

          {info ? (
            <View style={styles.profileCard}>
              <Text style={styles.name}>{info.nickname}</Text>
              <Text style={styles.bio}>{info.bio || t('lecturerDetail.empty')}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.courseCount}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.courses')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.studentCount}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.students')}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{info.followers}</Text>
                  <Text style={styles.statLabel}>{t('lecturerDetail.followers')}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.followBtn, info.isFollowing && styles.followingBtn]}
                onPress={handleFollow}
                disabled={followLoading}
              >
                <Text style={[styles.followBtnText, info.isFollowing && styles.followingBtnText]}>
                  {info.isFollowing
                    ? t('lecturerDetail.unfollowBtn')
                    : t('lecturerDetail.followBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('lecturerDetail.courses')}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('lecturerDetail.empty')}</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMetaText}>
              {t('lecturerDetail.level')}: {item.level}
            </Text>
            <Text style={styles.cardMetaText}>
              {t('lecturerDetail.studentCount', { count: item.studentCount })}
            </Text>
            <Text style={styles.priceText}>
              {item.price === 0 ? t('lecturerDetail.free') : `¥${item.price}`}
            </Text>
          </View>
        </View>
      )}
    />
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  header: { paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  profileCard: { padding: 16, borderRadius: 8, backgroundColor: '#F9FAFB', marginBottom: 12 },
  name: { fontSize: 20, fontWeight: '600', color: '#111827' },
  bio: { marginTop: 6, fontSize: 13, color: '#6B7280', lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '600', color: PRIMARY },
  statLabel: { marginTop: 2, fontSize: 11, color: '#6B7280' },
  followBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },
  followingBtn: { backgroundColor: '#F3F4F6' },
  followBtnText: { fontSize: 13, color: '#FFFFFF' },
  followingBtnText: { color: '#6B7280' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginVertical: 8 },
  card: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
    flexWrap: 'wrap',
  },
  cardMetaText: { fontSize: 11, color: '#9CA3AF' },
  priceText: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 13 },
})
