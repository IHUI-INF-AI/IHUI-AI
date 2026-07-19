import { useCallback, useState } from 'react'
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
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { usePaginatedList } from '../hooks/use-paginated-list'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CourseItem {
  id: string
  title: string
  instructor: string
  level: 'beginner' | 'intermediate' | 'advanced'
  price: number
  category: string
  cover: string | null
}

interface CoursePage {
  list: CourseItem[]
  total: number
}

const PAGE_SIZE = 20
const CATEGORIES = ['all', 'tech', 'design', 'business', 'language']
const LEVELS = ['all', 'beginner', 'intermediate', 'advanced']
const PRICE_TABS = ['all', 'free', 'paid']

export function CourseFilterScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [category, setCategory] = useState('all')
  const [level, setLevel] = useState('all')
  const [priceTab, setPriceTab] = useState('all')

  const fetcher = useCallback(async () => {
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(PAGE_SIZE),
      category,
      level,
      price: priceTab,
    })
    const resp = await fetch(`${API_BASE_URL}/api/courses?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) return { success: false as const, error: t('courseFilter.loadFailed') }
    const data = (await resp.json()) as { data?: CoursePage }
    const list = data.data?.list ?? []
    return { success: true as const, data: { list, total: data.data?.total ?? list.length } }
  }, [token, category, level, priceTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CourseItem>(fetcher, PAGE_SIZE)

  const applyFilter = () => {
    setTimeout(refresh, 0)
  }

  const reset = () => {
    setCategory('all')
    setLevel('all')
    setPriceTab('all')
    setTimeout(refresh, 50)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('courseFilter.title')}</Text>
        <Text style={styles.subtitle}>{t('courseFilter.subtitle')}</Text>
      </View>

      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>{t('courseFilter.category')}</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
                {t(`courseFilter.cat_${c}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>{t('courseFilter.level')}</Text>
        <View style={styles.chipRow}>
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLevel(l)}
              style={[styles.chip, level === l && styles.chipActive]}
            >
              <Text style={[styles.chipText, level === l && styles.chipTextActive]}>
                {t(`courseFilter.level_${l}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>{t('courseFilter.priceRange')}</Text>
        <View style={styles.chipRow}>
          {PRICE_TABS.map((p) => (
            <TouchableOpacity
              key={p}
              onPress={() => setPriceTab(p)}
              style={[styles.chip, priceTab === p && styles.chipActive]}
            >
              <Text style={[styles.chipText, priceTab === p && styles.chipTextActive]}>
                {t(`courseFilter.price_${p}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.resetBtn]} onPress={reset}>
            <Text style={styles.resetText}>{t('courseFilter.reset')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={applyFilter}>
            <Text style={styles.applyText}>{t('courseFilter.apply')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.retryText}>{t('courseFilter.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.emptyText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('courseFilter.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardMeta}>{t('courseFilter.instructor')}: {item.instructor}</Text>
              <View style={styles.cardMetaRow}>
                <Text style={styles.cardMetaText}>
                  {t('courseFilter.level_label')}: {t(`courseFilter.level_${item.level}`)}
                </Text>
                <Text style={styles.priceText}>
                  {item.price === 0 ? t('courseFilter.free') : `¥${item.price}`}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  )
}

const PRIMARY = '#10B981'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { marginBottom: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '600', color: '#111827' },
  subtitle: { marginTop: 4, fontSize: 13, color: '#6B7280' },
  filterSection: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9FAFB' },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6' },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { fontSize: 12, color: '#6B7280' },
  chipTextActive: { color: '#FFFFFF' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  resetBtn: { backgroundColor: '#F3F4F6' },
  applyBtn: { backgroundColor: PRIMARY },
  resetText: { fontSize: 13, color: '#6B7280' },
  applyText: { fontSize: 13, color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText: { fontSize: 12, color: '#DC2626' },
  retryText: { fontSize: 12, color: PRIMARY },
  center: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardMeta: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cardMetaText: { fontSize: 12, color: '#6B7280' },
  priceText: { fontSize: 14, fontWeight: '600', color: PRIMARY },
})
