import { useCallback, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Button, Card } from '@ihui/ui-native'
import { getFavorites, type FavoriteItem } from '@ihui/api-client'
import { deleteFavorite } from '../api/social'
import { usePaginatedList } from '../hooks/use-paginated-list'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

type FilterTab = 'all' | 'course' | 'live' | 'article'

const TABS: FilterTab[] = ['all', 'course', 'live', 'article']

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function typeEmoji(targetType: string): string {
  if (targetType === 'course') return '📚'
  if (targetType === 'live') return '🎥'
  if (targetType === 'article') return '📝'
  return '⭐'
}

export function FavoriteScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<FilterTab>('all')

  const fetcher = useCallback(async () => {
    const query: { page: number; pageSize: number; targetType?: string } = {
      page: 1,
      pageSize: PAGE_SIZE,
    }
    if (tab !== 'all') query.targetType = tab
    const res = await getFavorites(query)
    if (res.success) {
      return { success: true as const, data: res.data }
    }
    return { success: false as const, error: res.error || t('favorite.loadFailed') }
  }, [tab, t])

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FavoriteItem>(fetcher, PAGE_SIZE)

  const onSwitchTab = (next: FilterTab) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  const onDelete = (item: FavoriteItem) => {
    Alert.alert(t('favorite.deleteTitle'), item.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res = await deleteFavorite(item.targetType, item.targetId)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('favorite.deleteFailed'))
          }
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('favorite.title')}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.tokenBadge}>{token ? '●' : '○'}</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => onSwitchTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {t(`favorite.tab_${k}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('favorite.empty')}</Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerWrap}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card className="p-3">
            <View style={styles.itemRow}>
              {item.cover ? (
                <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverEmoji}>{typeEmoji(item.targetType)}</Text>
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.itemMeta}>
                  {t(`favorite.tab_${item.targetType}`)} · {formatDate(item.createdAt)}
                </Text>
              </View>
              <Button onPress={() => onDelete(item)} variant="outline" size="sm">
                {t('common.delete')}
              </Button>
            </View>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  tokenBadge: { fontSize: 12, color: '#10B981' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: '#10B981' },
  tabText: { fontSize: 12, color: '#6B7280' },
  tabTextActive: { color: '#FFFFFF' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  footerWrap: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 12, color: '#6B7280' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  cover: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F3F4F6' },
  coverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 24 },
  itemBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
})
