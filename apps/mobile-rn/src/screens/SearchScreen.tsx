import { useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Input, Loading } from '@ihui/ui-native'
interface SearchResult {
  id: string
  title: string
  summary: string
  type: 'course' | 'article' | 'post' | 'note' | 'agent'
  cover?: string
}

const SEARCH_TYPE_KEYS: Record<SearchResult['type'], string> = {
  course: 'search.type.course',
  article: 'search.type.article',
  post: 'search.type.post',
  note: 'search.type.note',
  agent: 'search.type.agent',
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function SearchScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const onSearch = async () => {
    const kw = keyword.trim()
    if (!kw) return
    setLoading(true)
    setError('')
    setSearched(true)
    const res = await fetchApi<SearchResult[]>(`/api/search?keyword=${encodeURIComponent(kw)}`)
    setLoading(false)
    if (res.success) setResults(res.data ?? [])
    else if (!res.success) setError(res.error || t('search.failed'))
  }

  const onPressResult = (item: SearchResult) => {
    if (item.type === 'course') navigation.navigate('CourseDetail', { id: item.id })
    else if (item.type === 'article') navigation.navigate('ArticleDetail', { id: item.id })
    else if (item.type === 'post') navigation.navigate('PostDetail', { id: item.id })
    else if (item.type === 'note') navigation.navigate('NoteDetail', { id: item.id })
    else if (item.type === 'agent') navigation.navigate('AgentDetail', { id: item.id })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('search.title')}</Text>
      </View>
      <View style={styles.searchRow}>
        <Input
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          onSubmitEditing={onSearch}
          autoFocus
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchText}>{t('common.search')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? <Loading style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && searched && results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>{t('search.empty')}</Text>
        </View>
      ) : null}
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.type}_${item.id}`}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => onPressResult(item)}>
            <Card className="p-3 mb-2">
              <View style={styles.cardHead}>
                <Text style={styles.type}>{t(SEARCH_TYPE_KEYS[item.type])}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardSummary} numberOfLines={2}>
                {item.summary}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  back: { fontSize: 14, color: '#6b7280' },
  title: { flex: 1, fontSize: 22, fontWeight: '600', color: '#111827' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#111827',
  },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: PRIMARY,
  },
  searchText: { color: '#fff', fontSize: 14 },
  muted: { fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  cardHead: { flexDirection: 'row', marginBottom: 4 },
  type: {
    fontSize: 10,
    color: PRIMARY,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  cardSummary: { marginTop: 4, fontSize: 13, color: '#374151' },
})
