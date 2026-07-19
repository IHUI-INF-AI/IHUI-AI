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
import { getFollowing, getFans, type FollowUser } from '@ihui/api-client'
import { unfollowUser } from '../api/social'
import { usePaginatedList } from '../hooks/use-paginated-list'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

type TabKey = 'following' | 'fans'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function Avatar({ url, nickname }: { url: string | null; nickname: string }) {
  if (url) {
    return <Image source={{ uri: url }} style={styles.avatar} />
  }
  const initial = (nickname || '?').slice(0, 1).toUpperCase()
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  )
}

export function FollowScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TabKey>('following')

  const fetcher = useCallback(
    async (query: { page: number; pageSize: number }) => {
      const apiFn = tab === 'following' ? getFollowing : getFans
      const res = await apiFn(query)
      if (res.success) {
        return { success: true as const, data: res.data }
      }
      return { success: false as const, error: res.error || t('follow.loadFailed') }
    },
    [tab, t],
  )

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<FollowUser>(fetcher, PAGE_SIZE)

  const onSwitchTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  const onUnfollow = (item: FollowUser) => {
    Alert.alert(t('follow.unfollowTitle'), `${item.nickname || item.username}?`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('follow.unfollow'),
        style: 'destructive',
        onPress: async () => {
          const res = await unfollowUser(item.id)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), res.error || t('follow.unfollowFailed'))
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
        <Text style={styles.title}>{t('follow.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {(['following', 'fans'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => onSwitchTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {t(`follow.tab_${k}`)}
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
              <Text style={styles.emptyText}>
                {tab === 'following' ? t('follow.emptyFollowing') : t('follow.emptyFans')}
              </Text>
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
        renderItem={({ item }) => {
          const isSelf = user?.id === item.id
          return (
            <Card className="p-3">
              <View style={styles.itemRow}>
                <Avatar url={item.avatar} nickname={item.nickname || item.username} />
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.nickname || item.username}
                  </Text>
                  {item.bio ? (
                    <Text style={styles.itemBio} numberOfLines={1}>
                      {item.bio}
                    </Text>
                  ) : null}
                  <Text style={styles.itemDate}>{formatDate(item.followedAt)}</Text>
                </View>
                {tab === 'following' && !isSelf ? (
                  <Button
                    onPress={() => onUnfollow(item)}
                    variant="outline"
                    size="sm"
                  >
                    {t('follow.unfollow')}
                  </Button>
                ) : null}
              </View>
            </Card>
          )
        }}
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
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 14,
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
  avatar: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#F3F4F6' },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '600', color: '#4B5563' },
  itemBody: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemBio: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
})
