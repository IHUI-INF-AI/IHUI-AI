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
import { usePaginatedList } from '../hooks/use-paginated-list'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Certificate {
  id: string
  name: string
  issuer: string
  issueDate: string
  expireDate: string | null
  status: 'valid' | 'expired' | 'revoked'
  cover: string | null
}

interface CertPage {
  list: Certificate[]
  total: number
}

const PAGE_SIZE = 20

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function statusColor(status: Certificate['status']): string {
  if (status === 'valid') return '#10B981'
  if (status === 'expired') return '#9CA3AF'
  return '#EF4444'
}

export function CertificateScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'valid' | 'expired'>('all')

  const fetcher = useCallback(async () => {
    const url = `${API_BASE_URL}/api/certificates?page=1&pageSize=${PAGE_SIZE}&status=${selectedStatus}`
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!resp.ok) {
      return { success: false as const, error: t('certificate.loadFailed') }
    }
    const data = (await resp.json()) as { data?: CertPage }
    const list = data.data?.list ?? []
    return { success: true as const, data: { list, total: data.data?.total ?? list.length } }
  }, [token, selectedStatus, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<Certificate>(
    fetcher,
    PAGE_SIZE,
  )

  const onSwitchStatus = (next: 'all' | 'valid' | 'expired') => {
    if (next === selectedStatus) return
    setSelectedStatus(next)
    setTimeout(refresh, 0)
  }

  const onItemPress = (item: Certificate) => {
    Alert.alert(item.name, `${item.issuer}\n${formatDate(item.issueDate)}`)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('certificate.title')}</Text>
      </View>

      <View style={styles.tabs}>
        {(['all', 'valid', 'expired'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onSwitchStatus(s)}
            style={[styles.tab, selectedStatus === s && styles.tabActive]}
          >
            <Text style={[styles.tabText, selectedStatus === s && styles.tabTextActive]}>
              {t(`certificate.filter_${s}`)}
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
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('certificate.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card className="p-3">
            <View style={styles.itemRow}>
              {item.cover ? (
                <Image source={{ uri: item.cover }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Text style={styles.coverEmoji}>📜</Text>
                </View>
              )}
              <View style={styles.itemBody}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.itemIssuer} numberOfLines={1}>
                  {item.issuer}
                </Text>
                <Text style={styles.itemDate}>
                  {t('certificate.issueDate')}: {formatDate(item.issueDate)}
                </Text>
                {item.expireDate ? (
                  <Text style={styles.itemDate}>
                    {t('certificate.expireDate')}: {formatDate(item.expireDate)}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>
                  {t(`certificate.status_${item.status}`)}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => onItemPress(item)} style={styles.detailBtn}>
              <Text style={styles.detailText}>{t('certificate.viewDetail')}</Text>
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
  itemBody: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  itemIssuer: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, color: '#FFFFFF' },
  detailBtn: {
    marginTop: 8,
    paddingVertical: 6,
    alignItems: 'flex-end',
  },
  detailText: { fontSize: 12, color: '#10B981' },
})
