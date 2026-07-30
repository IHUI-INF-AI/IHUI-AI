import { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SearchScreen as SharedSearchScreen, type SearchScreenItem } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { SearchInput } from '../components/SearchInput'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * mobile-rn 搜索页(2026-07-30 接入本地 SearchInput)
 *
 * shell 层职责:
 * - 顶部挂载 mobile-rn 本地 SearchInput(快捷搜索栏,带清除按钮 + 聚焦态)
 * - 下方复用 @ihui/rn-app.SharedSearchScreen(结果列表 / loading / 错误)
 * - onSubmit 同步触发 SharedSearchScreen 的搜索逻辑
 */
export function SearchScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const runSearch = useCallback(async (kw: string) => {
    const trimmed = kw.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setSearched(true)
    const res = await fetchApi<SearchScreenItem[]>(`/api/search?keyword=${encodeURIComponent(trimmed)}`)
    setLoading(false)
    if (res.success) setResults(res.data ?? [])
    else setError(res.error || t('search.failed'))
  }, [t])

  const onSearch = useCallback(() => {
    void runSearch(keyword)
  }, [keyword, runSearch])

  const onPressItem = (item: SearchScreenItem) => {
    if (item.type === 'course') navigation.navigate('CourseDetail', { id: item.id })
    else if (item.type === 'article') navigation.navigate('ArticleDetail', { id: item.id })
    else if (item.type === 'post') navigation.navigate('PostDetail', { id: item.id })
    else if (item.type === 'note') navigation.navigate('NoteDetail', { id: item.id })
    else if (item.type === 'agent') navigation.navigate('AgentDetail', { id: item.id })
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <SearchInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder={t('search.placeholder')}
          onSubmit={onSearch}
        />
      </View>
      <View style={styles.body}>
        <SharedSearchScreen
          t={t}
          keyword={keyword}
          results={results}
          loading={loading}
          error={error}
          searched={searched}
          onKeywordChange={setKeyword}
          onSearch={onSearch}
          onPressItem={onPressItem}
          onBack={() => navigation.goBack()}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  body: {
    flex: 1,
  },
})
