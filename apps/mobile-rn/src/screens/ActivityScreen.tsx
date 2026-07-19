import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ActivityStatus = 'upcoming' | 'ongoing' | 'ended'

interface Activity {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  status: ActivityStatus
  participants: number
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function statusColor(status: ActivityStatus): string {
  if (status === 'ongoing') return '#10B981'
  if (status === 'upcoming') return '#F59E0B'
  return '#9CA3AF'
}

export function ActivityScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/activities`)
      if (!resp.ok) throw new Error('http')
      const data = (await resp.json()) as { data?: Activity[] }
      setItems(data.data ?? [])
    } catch {
      setError(t('activity.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('activity.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('activity.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.badgeText}>{t(`activity.status_${item.status}`)}</Text>
              </View>
            </View>
            <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
            <Text style={styles.meta}>{t('activity.startTime')}: {formatDate(item.startTime)}</Text>
            <Text style={styles.meta}>{t('activity.endTime')}: {formatDate(item.endTime)}</Text>
            <Text style={styles.meta}>{t('activity.participants')}: {item.participants}</Text>
            <TouchableOpacity style={styles.joinBtn}>
              <Text style={styles.joinText}>{t('activity.joinNow')}</Text>
            </TouchableOpacity>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  card: { padding: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#FFFFFF' },
  itemDesc: { marginTop: 6, fontSize: 12, color: '#374151', lineHeight: 18 },
  meta: { marginTop: 4, fontSize: 11, color: '#9CA3AF' },
  joinBtn: { marginTop: 8, paddingVertical: 6, alignItems: 'flex-end' },
  joinText: { fontSize: 12, color: '#10B981' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280' },
})
