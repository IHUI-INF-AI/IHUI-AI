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
  question: string
  asker: string
  answerCount: number
  createdAt: string
}

export function CourseQAListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Item[]>('/course-qa')
      if (!res.success) throw new Error()
      setItems(res.data ?? [])
    } catch {
      setError(t('courseQAList.loadFailed'))
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
        <Text style={s.title}>{t('courseQAList.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CourseQAAsk')}>
          <Text style={s.ask}>{t('courseQAList.ask')}</Text>
        </TouchableOpacity>
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
              <Text style={s.muted}>{t('courseQAList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="p-3">
              <Text style={s.cardTitle} numberOfLines={2}>
                {item.question}
              </Text>
              <Text style={s.cardMeta}>
                {t('courseQAList.asker')}: {item.asker} · {t('courseQAList.answers')}:{' '}
                {item.answerCount}
              </Text>
              <Text style={s.cardTime}>{item.createdAt}</Text>
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
  title: { flex: 1, fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  ask: { fontSize: 13, color: tokens.success.DEFAULT, fontWeight: '600' },
  error: { paddingHorizontal: 16, fontSize: 12, color: tokens.danger.DEFAULT },
  center: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light },
  cardTitle: { fontSize: 14, fontWeight: '600', color: tokens.text.primary },
  cardMeta: { marginTop: 6, fontSize: 11, color: tokens.text.secondary },
  cardTime: { marginTop: 4, fontSize: 11, color: tokens.text.tertiary },
})
