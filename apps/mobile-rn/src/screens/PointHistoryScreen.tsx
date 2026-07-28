import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { PointRecord } from '@ihui/types'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item extends Pick<PointRecord, 'id' | 'createdAt'> {
  action: string // = type 别名(本地用 action 字段名)
  points: number // = amount 别名(本地用 points 字段名)
  balance: number // 本地必填,共享可选,协变合法
}

export function PointHistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Item[]>('/point-history')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('pointHistory.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('pointHistory.title')}</Text>
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
              <Text style={s.muted}>{t('pointHistory.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.titleRow}>
                <Text style={s.cardTitle}>{item.action}</Text>
                <Text style={[s.cardPoints, item.points < 0 && { color: tokens.danger.DEFAULT }]}>
                  {item.points > 0 ? '+' : ''}
                  {item.points}
                </Text>
              </View>
              <View style={s.metaRow}>
                <Text style={s.cardMeta}>
                  {t('pointHistory.balance')}: {item.balance}
                </Text>
                <Text style={s.cardTime}>{item.createdAt}</Text>
              </View>
            </View>
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
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  cardPoints: { fontSize: 14, fontWeight: '600', color: tokens.success.DEFAULT },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  cardMeta: { fontSize: 11, color: tokens.text.secondary },
  cardTime: { fontSize: 11, color: tokens.text.tertiary },
})
