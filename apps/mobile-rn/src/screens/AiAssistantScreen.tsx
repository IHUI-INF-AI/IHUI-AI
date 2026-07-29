import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { getAgents, type Agent } from '@ihui/api-client'
import {
  AiAssistantScreen as SharedAiAssistantScreen,
  type AiAssistantCategory,
  type AiAssistantCategoryOption,
  type AiAssistantItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'

export default function AiAssistantScreen() {
  const { t } = useI18n()
  const [category, setCategory] = useState<AiAssistantCategory>('all')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<AiAssistantItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const categories: AiAssistantCategoryOption[] = useMemo(
    () => [
      { id: 'all', label: t('aiAssistant.catAll') },
      { id: 'writing', label: t('aiAssistant.catWriting') },
      { id: 'coding', label: t('aiAssistant.catCoding') },
      { id: 'office', label: t('aiAssistant.catOffice') },
      { id: 'study', label: t('aiAssistant.catStudy') },
    ],
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    const resp = await getAgents({ status: 'published' })
    if (resp.success) {
      setItems(
        (resp.data.list ?? []).map((a: Agent): AiAssistantItem => ({
          id: a.id,
          name: a.name,
          description: a.description,
          category: a.category,
          tags: a.tags,
          useCount: a.useCount,
          favoriteCount: a.favoriteCount,
        })),
      )
    } else {
      setError(resp.error || t('aiAssistant.loadFailed'))
    }
    setLoading(false)
    setRefreshing(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (category !== 'all' && a.category !== category) return false
      return keyword ? a.name.includes(keyword) || a.description.includes(keyword) : true
    })
  }, [items, category, keyword])

  return (
    <SharedAiAssistantScreen
      t={t}
      items={filtered}
      categories={categories}
      category={category}
      keyword={keyword}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onCategoryChange={setCategory}
      onKeywordChange={setKeyword}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onPressItem={(a) =>
        Alert.alert(t('aiAssistant.chat.title'), t('aiAssistant.chat.message', { name: a.name }))
      }
      onBack={() => undefined}
    />
  )
}
