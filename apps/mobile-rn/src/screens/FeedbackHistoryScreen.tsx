import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item {
  id: string
  type: string
  status: string
  content: string
  createdAt: string
}

export function FeedbackHistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Item[]>('/feedbacks')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('feedbackHistory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const statusColor = (status: string) =>
    status === 'resolved' ? '#10B981' : status === 'pending' ? '#F59E0B' : '#9CA3AF'

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('feedbackHistory.title')}</Text>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={s.center}>
          <Loading />
          <Text style={s.muted}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
            />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.muted}>{t('feedbackHistory.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              onPress={() => navigation.navigate('FeedbackDetail', { id: item.id })}
            >
              <View style={s.titleRow}>
                <Text style={s.cardType}>{item.type}</Text>
                <Text style={[s.cardStatus, { color: statusColor(item.status) }]}>
                  {item.status}
                </Text>
              </View>
              <Text style={s.cardContent} numberOfLines={2}>
                {item.content}
              </Text>
              <Text style={s.cardTime}>
                {t('feedbackHistory.createdAt')}: {item.createdAt}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  error: { paddingHorizontal: 16, fontSize: 12, color: tokens.danger.DEFAULT },
  center: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardType: { fontSize: 13, fontWeight: '600', color: tokens.success.DEFAULT },
  cardStatus: { fontSize: 12, fontWeight: '600' },
  cardContent: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  cardTime: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
})
