import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import { formatShortDateWithYear } from '../utils/date-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type ActivityStatus = 'upcoming' | 'ongoing' | 'ended'

const ACTIVITY_STATUS_KEYS: Record<ActivityStatus, string> = {
  upcoming: 'activity.status_upcoming',
  ongoing: 'activity.status_ongoing',
  ended: 'activity.status_ended',
}

interface Activity {
  id: string
  title: string
  description: string
  startTime: string
  endTime: string
  status: ActivityStatus
  participants: number
}

function statusColor(status: ActivityStatus): string {
  if (status === 'ongoing') return tokens.brand.DEFAULT
  if (status === 'upcoming') return tokens.warning.DEFAULT
  return tokens.text.tertiary
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
      const res = await fetchApi<Activity[]>('/activities')
      if (!res.success) throw new Error('http')
      setItems(res.data ?? [])
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
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.badgeText}>{t(ACTIVITY_STATUS_KEYS[item.status])}</Text>
              </View>
            </View>
            <Text style={styles.itemDesc} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={styles.meta}>
              {t('activity.startTime')}: {formatShortDateWithYear(item.startTime)}
            </Text>
            <Text style={styles.meta}>
              {t('activity.endTime')}: {formatShortDateWithYear(item.endTime)}
            </Text>
            <Text style={styles.meta}>
              {t('activity.participants')}: {item.participants}
            </Text>
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
  container: { flex: 1, backgroundColor: tokens.surface.light },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: tokens.error.text },
  card: { padding: 12, borderRadius: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 10, color: tokens.surface.light },
  itemDesc: { marginTop: 6, fontSize: 12, color: tokens.text.medium, lineHeight: 18 },
  meta: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
  joinBtn: { marginTop: 8, paddingVertical: 6, alignItems: 'flex-end' },
  joinText: { fontSize: 12, color: tokens.brand.DEFAULT },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: tokens.text.secondary },
})
