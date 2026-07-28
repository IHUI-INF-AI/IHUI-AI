import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
import type { Article } from '@ihui/types'

interface Note extends Pick<Article, 'id' | 'title' | 'summary' | 'createdAt'> {
  author: string
  likes: number
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function NoteListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const res = await fetchApi<Note[]>('/api/notes/public')
    if (res.success) setNotes(res.data ?? [])
    else setError(res.error || t('noteList.loadFailed'))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading)
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error && notes.length === 0)
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
        <Text style={styles.title}>{t('noteList.title')}</Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate({ name: 'NoteCreate', params: { courseId: undefined } })
          }
        >
          <Text style={styles.action}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('noteList.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('NoteDetail', { id: item.id })}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardSummary} numberOfLines={2}>
              {item.summary}
            </Text>
            <View style={styles.row}>
              <Text style={styles.author}>{item.author}</Text>
              <Text style={styles.meta}>
                ❤ {item.likes} · {item.createdAt}
              </Text>
            </View>
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
  action: { fontSize: 24, color: tokens.success.DEFAULT, fontWeight: '600' },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tokens.border.light, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
  cardSummary: { marginTop: 4, fontSize: 13, color: tokens.text.medium },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  author: { fontSize: 11, color: tokens.success.DEFAULT },
  meta: { fontSize: 11, color: tokens.text.tertiary },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
