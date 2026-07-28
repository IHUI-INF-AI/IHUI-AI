import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Loading } from '@ihui/ui-native'
interface HistoryItem {
  id: string
  targetId: string
  targetType: 'course' | 'article' | 'post' | 'note' | 'live'
  title: string
  visitedAt: string
}

const HISTORY_TYPE_KEYS: Record<HistoryItem['targetType'], string> = {
  course: 'history.type.course',
  article: 'history.type.article',
  post: 'history.type.post',
  note: 'history.type.note',
  live: 'history.type.live',
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function HistoryScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<HistoryItem[]>('/api/history')
    if (res.success) setItems(res.data ?? [])
    else setError(res.error || t('history.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const onPress = (item: HistoryItem) => {
    if (item.targetType === 'course') navigation.navigate('CourseDetail', { id: item.targetId })
    else if (item.targetType === 'article')
      navigation.navigate('ArticleDetail', { id: item.targetId })
    else if (item.targetType === 'post') navigation.navigate('PostDetail', { id: item.targetId })
    else if (item.targetType === 'note') navigation.navigate('NoteDetail', { id: item.targetId })
    else if (item.targetType === 'live') navigation.navigate('LiveDetail', { id: item.targetId })
  }

  if (loading)
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error && items.length === 0)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
        <TouchableOpacity onPress={() => load(true)}>
          <Text style={styles.clear}>{t('history.refresh')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('history.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPress(item)}>
            <Card className="p-3 mb-2">
              <View style={styles.cardHead}>
                <Text style={styles.type}>{t(HISTORY_TYPE_KEYS[item.targetType])}</Text>
                <Text style={styles.meta}>{item.visitedAt}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg, paddingHorizontal: 16, paddingTop: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { fontSize: 14, color: tokens.text.secondary },
  title: { flex: 1, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  clear: { fontSize: 13, color: tokens.success.DEFAULT },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  type: {
    fontSize: 10,
    color: tokens.success.DEFAULT,
    backgroundColor: tokens.success.light,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meta: { fontSize: 11, color: tokens.text.tertiary },
  cardTitle: { fontSize: 14, fontWeight: '500', color: tokens.text.primary },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
