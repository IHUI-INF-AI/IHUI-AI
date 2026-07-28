import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item { id: string; action: string; operator: string; time: string; note: string }

export function OrderLogScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Item[]>('/order-log')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch { setError(t('orderLog.loadFailed')) } finally { setLoading(false); setRefreshing(false) }
  }, [t])

  useEffect(() => { void load() }, [load])

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>{t('common.back')}</Text></TouchableOpacity>
        <Text style={s.title}>{t('orderLog.title')}</Text>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={s.center}><Loading /><Text style={s.muted}>{t('common.loading')}</Text></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>{t('orderLog.empty')}</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.titleRow}>
                <Text style={s.cardTitle}>{t('orderLog.action')}: {item.action}</Text>
                <Text style={s.cardTime}>{item.time}</Text>
              </View>
              <Text style={s.cardMeta}>{t('orderLog.operator')}: {item.operator}</Text>
              {item.note ? <Text style={s.cardNote} numberOfLines={2}>{item.note}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  error: { paddingHorizontal: 16, fontSize: 12, color: tokens.danger.DEFAULT },
  center: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  cardTime: { fontSize: 11, color: tokens.text.tertiary },
  cardMeta: { marginTop: 4, fontSize: 12, color: tokens.text.secondary },
  cardNote: { marginTop: 4, fontSize: 12, color: tokens.text.tertiary },
})
