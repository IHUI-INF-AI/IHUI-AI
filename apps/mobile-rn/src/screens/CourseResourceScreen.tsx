import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card } from '@ihui/ui-native'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item {
  id: string
  name: string
  size: number
  type: string
}

export function CourseResourceScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Item[]>('/course-resource')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('courseResource.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const fmtSize = (b: number) =>
    b < 1024
      ? `${b}B`
      : b < 1048576
        ? `${(b / 1024).toFixed(1)}KB`
        : `${(b / 1048576).toFixed(1)}MB`

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('courseResource.title')}</Text>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator />
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
              <Text style={s.muted}>{t('courseResource.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="p-3">
              <Text style={s.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={s.metaRow}>
                <Text style={s.cardMeta}>
                  {t('courseResource.type')}: {item.type} · {t('courseResource.size')}:{' '}
                  {fmtSize(item.size)}
                </Text>
                <Text style={s.cardAction}>{t('courseResource.open')}</Text>
              </View>
            </Card>
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
  cardTitle: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardMeta: { fontSize: 11, color: tokens.text.tertiary },
  cardAction: { fontSize: 12, color: tokens.success.DEFAULT, fontWeight: '600' },
})
