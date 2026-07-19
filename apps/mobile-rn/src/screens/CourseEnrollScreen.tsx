import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { enrollCourse, getCourses, type Course } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function formatPrice(course: Course): string {
  if (course.isFree || course.price === 0) return ''
  return `¥${course.price.toFixed(2)}`
}

export function CourseEnrollScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getCourses({ keyword: keyword || undefined, pageSize: 20 })
      if (res.success) {
        setCourses(res.data.list ?? [])
      } else {
        setError(res.error || t('courseEnroll.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [keyword, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleEnroll = async (course: Course) => {
    if (course.isEnrolled || enrollingId) return
    setEnrollingId(course.id)
    setToast('')
    const res = await enrollCourse(course.id)
    setEnrollingId(null)
    if (res.success) {
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, isEnrolled: true } : c)),
      )
      setToast(t('courseEnroll.enrollSuccess', { title: course.title }))
    } else {
      setToast(res.error || t('courseEnroll.enrollFailed'))
    }
  }

  const handleSearch = () => {
    void load()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && courses.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
          <Text style={styles.retryText}>{t('courseEnroll.retry')}</Text>
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
        <Text style={styles.title}>{t('courseEnroll.title')}</Text>
        <Text style={styles.subtitle}>{t('courseEnroll.subtitle')}</Text>
        <Text style={styles.userText}>{user?.nickname ?? user?.username ?? ''}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={t('courseEnroll.searchPlaceholder')}
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>

      {toast ? <Text style={styles.toastText}>{toast}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        style={styles.list}
        data={courses}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('courseEnroll.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.isEnrolled ? (
                <View style={styles.badgeEnrolled}>
                  <Text style={styles.badgeText}>{t('courseEnroll.enrolled')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardMeta}>
              {t('courseEnroll.instructor')}:{item.instructor}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMetaText}>
                {t('courseEnroll.level')}:{item.level}
              </Text>
              <Text style={styles.cardMetaText}>
                {t('courseEnroll.lessons')}:{item.lessonCount}
              </Text>
              <Text style={styles.cardMetaText}>
                {t('courseEnroll.students')}:{item.studentCount}
              </Text>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.priceText}>
                {item.isFree ? t('courseEnroll.free') : formatPrice(item)}
              </Text>
              <TouchableOpacity
                style={[
                  styles.enrollBtn,
                  (item.isEnrolled || enrollingId === item.id) && styles.enrollBtnDisabled,
                ]}
                onPress={() => handleEnroll(item)}
                disabled={item.isEnrolled || enrollingId === item.id}
              >
                {enrollingId === item.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.enrollBtnText}>
                    {item.isEnrolled
                      ? t('courseEnroll.enrolled')
                      : t('courseEnroll.enroll')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
  },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  searchBtnText: { color: '#fff', fontSize: 14 },
  toastText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: PRIMARY },
  errorText: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, color: '#dc2626' },
  list: { flex: 1, paddingHorizontal: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', marginRight: 8 },
  badgeEnrolled: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#d1fae5' },
  badgeText: { fontSize: 11, color: '#047857' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  cardMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cardMetaText: { fontSize: 12, color: '#6b7280' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  priceText: { fontSize: 16, fontWeight: '600', color: PRIMARY },
  enrollBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  enrollBtnDisabled: { backgroundColor: '#9ca3af' },
  enrollBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  retryBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  retryText: { color: '#fff', fontSize: 14 },
})
