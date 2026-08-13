import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgents, type Agent } from '@ihui/api-client'
import {
  AiAssistantScreen as SharedAiAssistantScreen,
  type AiAssistantItem,
  type AiAssistantCategory,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function AiAssistantScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [category, setCategory] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories: AiAssistantCategory[] = useMemo(
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
    setError(null)
    try {
      const resp = await getAgents({ status: 'published' })
      if (!resp.success) throw new Error(resp.error)
      setAgents(resp.data.list ?? [])
    } catch {
      setError(t('aiAssistant.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const items: AiAssistantItem[] = useMemo(() => {
    return agents
      .filter((a) => {
        if (category !== 'all' && a.category !== category) return false
        return keyword ? a.name.includes(keyword) || a.description.includes(keyword) : true
      })
      .map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        tags: a.tags,
        useCount: a.useCount,
        favoriteCount: a.favoriteCount,
      }))
  }, [agents, category, keyword])

  return (
    <SharedAiAssistantScreen
      t={t}
      items={items}
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
      onPressItem={(item) =>
        navigation.navigate('AiAssistantN8n', { agentId: item.id })
      }
      onPressCategory={(categoryId, title) =>
        navigation.navigate('CategoryDetail', { categoryId, title })
      }
      onBack={() => undefined}
    />
  )
}
