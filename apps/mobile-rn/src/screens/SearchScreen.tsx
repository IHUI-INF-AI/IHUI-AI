import { useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SearchScreen as SharedSearchScreen, type SearchScreenItem } from '@ihui/rn-app'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function SearchScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const onSearch = async () => {
    const kw = keyword.trim()
    if (!kw) return
    setLoading(true)
    setError('')
    setSearched(true)
    const res = await fetchApi<SearchScreenItem[]>(`/api/search?keyword=${encodeURIComponent(kw)}`)
    setLoading(false)
    if (res.success) setResults(res.data ?? [])
    else setError(res.error || t('search.failed'))
  }

  const onPressItem = (item: SearchScreenItem) => {
    if (item.type === 'course') navigation.navigate('CourseDetail', { id: item.id })
    else if (item.type === 'article') navigation.navigate('ArticleDetail', { id: item.id })
    else if (item.type === 'post') navigation.navigate('PostDetail', { id: item.id })
    else if (item.type === 'note') navigation.navigate('NoteDetail', { id: item.id })
    else if (item.type === 'agent') navigation.navigate('AgentDetail', { id: item.id })
  }

  return (
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
  )
}
