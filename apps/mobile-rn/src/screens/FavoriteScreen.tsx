import { rnLightTokens as tokens } from '@ihui/design-tokens'
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
import { usePaginatedList } from '../hooks'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

type FilterTab = 'all' | 'course' | 'live' | 'article'

const TABS: FilterTab[] = ['all', 'course', 'live', 'article']

const FAVORITE_TAB_KEYS: Record<FilterTab, string> = {
  all: 'favorite.tab_all',
  course: 'favorite.tab_course',
  live: 'favorite.tab_live',
  article: 'favorite.tab_article',
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
              {t(FAVORITE_TAB_KEYS[k])}
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
                  {t(FAVORITE_TAB_KEYS[item.targetType as FilterTab] ?? 'favorite.tab_all')} ·{' '}
                  {formatShortDateWithYear(item.createdAt)}
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
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: tokens.surface.muted,
  },
  backBtn: { marginRight: 12 },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  tokenBadge: { fontSize: 12, color: tokens.success.DEFAULT },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  tabActive: { backgroundColor: tokens.success.DEFAULT },
  tabText: { fontSize: 12, color: tokens.text.secondary },
  tabTextActive: { color: tokens.surface.light },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  footerWrap: { alignItems: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 12, color: tokens.text.secondary },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  cover: { width: 56, height: 56, borderRadius: 8, backgroundColor: tokens.surface.card },
  coverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 24 },
  itemBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  itemMeta: { fontSize: 11, color: tokens.text.tertiary, marginTop: 4 },
})
