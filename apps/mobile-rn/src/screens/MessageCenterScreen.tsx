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
import { Card } from '@ihui/ui-native'
import {
  getNotifications,
  markNotificationRead,
  markMessageRead,
  deleteNotification,
  deleteMessage,
  markAllNotificationsRead,
  markAllMessagesRead,
  type NotificationItem,
  type MessageItem,
} from '@ihui/api-client'
import { usePaginatedList } from '../hooks/use-paginated-list'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

type TabKey = 'notification' | 'message'
type Item =
  | (NotificationItem & { _kind: 'notification' })
  | (MessageItem & { _kind: 'message' })

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

interface MessagePage {
  list: MessageItem[]
  total: number
}

export function MessageCenterScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TabKey>('notification')

  const fetcher = useCallback(async () => {
    if (tab === 'notification') {
      const res = await getNotifications({ page: 1, pageSize: PAGE_SIZE })
      if (res.success) {
        const list = res.data.list.map((n) => ({ ...n, _kind: 'notification' as const }))
        return { success: true as const, data: { list, total: res.data.total } }
      }
      return { success: false as const, error: res.error || t('messageCenter.loadFailed') }
    }
    // getMessages 与 chat.ts 的 getMessages 命名冲突,用 fetch 自封装调用 /api/messages
    const url = `${API_BASE_URL}/api/messages?page=1&pageSize=${PAGE_SIZE}`
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) {
      return { success: false as const, error: t('messageCenter.loadFailed') }
    }
    const data = (await resp.json()) as { data?: MessagePage }
    const list = (data.data?.list ?? []).map((m) => ({ ...m, _kind: 'message' as const }))
    return {
      success: true as const,
      data: { list, total: data.data?.total ?? list.length },
    }
  }, [tab, t, token])

  const { items, loading, refreshing, loadingMore, error, refresh, loadMore, removeItem } =
    usePaginatedList<Item>(fetcher, PAGE_SIZE)

  const onSwitchTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    setTimeout(refresh, 0)
  }

  const onMarkRead = async (item: Item) => {
    if (item.isRead) return
    const res =
      item._kind === 'notification'
        ? await markNotificationRead(item.id)
        : await markMessageRead(item.id)
    if (res.success) {
      refresh()
    } else {
      Alert.alert(t('common.failed'), t('messageCenter.markReadFailed'))
    }
  }

  const onDelete = (item: Item) => {
    Alert.alert(t('messageCenter.deleteTitle'), t('messageCenter.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const res =
            item._kind === 'notification'
              ? await deleteNotification(item.id)
              : await deleteMessage(item.id)
          if (res.success) {
            removeItem((i) => i.id === item.id)
          } else {
            Alert.alert(t('common.failed'), t('messageCenter.deleteFailed'))
          }
        },
      },
    ])
  }

  const onMarkAllRead = async () => {
    const res =
      tab === 'notification' ? await markAllNotificationsRead() : await markAllMessagesRead()
    if (res.success) {
      refresh()
    } else {
      Alert.alert(t('common.failed'), t('messageCenter.markReadFailed'))
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('messageCenter.title')}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={onMarkAllRead} style={styles.markAllBtn}>
          <Text style={styles.markAllText}>{t('messageCenter.markAllRead')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['notification', 'message'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            onPress={() => onSwitchTab(k)}
            style={[styles.tab, tab === k && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {t(`messageCenter.tab_${k}`)}
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
                {tab === 'notification'
                  ? t('messageCenter.emptyNotification')
                  : t('messageCenter.emptyMessage')}
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
        renderItem={({ item }) => (
          <Card className="p-3">
            <TouchableOpacity onPress={() => onMarkRead(item)} style={styles.itemBtn}>
              <View style={styles.itemRow}>
                <View
                  style={[styles.dot, item.isRead ? styles.dotRead : styles.dotUnread]}
                />
                <View style={styles.itemBody}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item._kind === 'notification'
                      ? item.title
                      : `${item.fromNickname}${t('messageCenter.messageSuffix')}`}
                  </Text>
                  <Text style={styles.itemContent} numberOfLines={2}>
                    {item.content}
                  </Text>
                  <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
                </View>
                {item._kind === 'message' && item.fromAvatar ? (
                  <Image source={{ uri: item.fromAvatar }} style={styles.avatar} />
                ) : null}
                <TouchableOpacity
                  onPress={() => onDelete(item)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteText}>×</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
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
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  markAllText: { fontSize: 12, color: '#10B981' },
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
  itemBtn: {},
  itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 8 },
  dotRead: { backgroundColor: '#D1D5DB' },
  dotUnread: { backgroundColor: '#10B981' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemContent: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  itemDate: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  avatar: { width: 32, height: 32, borderRadius: 8, marginLeft: 8, backgroundColor: '#F3F4F6' },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteText: { fontSize: 14, color: '#DC2626', fontWeight: '600' },
})
