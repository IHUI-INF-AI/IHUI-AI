import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatShortDateWithYear } from '../utils/date-utils'
import type { NotificationItem } from '@ihui/types'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Announcement extends NotificationItem {
  publishTime: string
  pinned: boolean
}

export function AnnouncementScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Announcement[]>('/announcements')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('announcement.loadFailed'))
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
        <Text style={styles.title}>{t('announcement.title')}</Text>
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
              <Text style={styles.muted}>{t('announcement.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.titleRow}>
              {item.pinned ? (
                <View style={styles.pinnedBadge}>
                  <Text style={styles.pinnedText}>{t('announcement.pinned')}</Text>
                </View>
              ) : null}
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.itemContent} numberOfLines={3}>
              {item.content}
            </Text>
            <Text style={styles.publishTime}>
              {t('announcement.publishTime')}: {formatShortDateWithYear(item.publishTime)}
            </Text>
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
    gap: 12,
  },
  backText: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: tokens.danger.DEFAULT },
  card: { padding: 12, borderRadius: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinnedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: tokens.warning.amberLight,
  },
  pinnedText: { fontSize: 10, color: tokens.warning.amberText },
  itemTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  itemContent: { marginTop: 6, fontSize: 12, color: tokens.text.medium, lineHeight: 18 },
  publishTime: { marginTop: 8, fontSize: 11, color: tokens.text.tertiary },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: tokens.text.secondary },
})
