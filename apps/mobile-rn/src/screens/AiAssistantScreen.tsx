import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getAgentCategories, getAgents, type Agent, type AgentCategoryItem } from '@ihui/api-client'
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

  // 分类静态兜底(与 AgentScreen AGENT_MAIN_CATEGORY_FALLBACK 同源同语义,API 失败时使用)
  const fallbackCategories: AiAssistantCategory[] = useMemo(
    () => [
      { id: 'all', label: t('aiAssistant.catAll') },
      { id: 'writing', label: t('aiAssistant.catWriting') },
      { id: 'coding', label: t('aiAssistant.catCoding') },
      { id: 'office', label: t('aiAssistant.catOffice') },
      { id: 'study', label: t('aiAssistant.catStudy') },
    ],
    [t],
  )
  // 分类数据源与 AgentScreen 复用同一 getAgentCategories API(agentMainCategory),
  // 失败回退静态 5 项,保证两个页面分类一致。
  const [categories, setCategories] = useState<AiAssistantCategory[]>(fallbackCategories)

  const loadCategories = useCallback(async (): Promise<void> => {
    try {
      const res = await getAgentCategories()
      if (res.success && res.data && Array.isArray(res.data.agentMainCategory)) {
        const main: AgentCategoryItem[] = res.data.agentMainCategory
        setCategories([
          { id: 'all', label: t('aiAssistant.catAll') },
          ...main.map((c) => ({ id: c.id, label: c.name })),
        ])
        return
      }
    } catch {
      // 分类加载失败:保持兜底列表,不阻塞主流程
    }
    setCategories(fallbackCategories)
  }, [t, fallbackCategories])

  const load = useCallback(async () => {
    setError(null)
    try {
      await Promise.all([
        (async () => {
          const resp = await getAgents({ status: 'published' })
          if (!resp.success) throw new Error(resp.error)
          setAgents(resp.data.list ?? [])
        })(),
        loadCategories(),
      ])
    } catch {
      setError(t('aiAssistant.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, loadCategories])

  // 分类列表变化后,若当前选中项已不存在(如 API 分类与兜底切换),重置为 all
  useEffect(() => {
    if (!categories.some((c) => c.id === category)) {
      setCategory('all')
    }
  }, [categories, category])

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
        // 对齐 Uniapp ai_index.vue selectAgent/pitchHandlea(行 980-1003):智能体点击跳
        // AI 生成助手对话页 /pages/tools/ai_assistant?modelNamea=&type=&code=。
        // RN 中该语义由 AiAssistantN8nScreen 承载:它是唯一支持 agentId 绑定流式对话的页面
        // (streamChat({ agentId })),title 即 Uniapp 的 modelNamea(智能体名);
        // ChatScreen(ai_index 社区主屏移植)不消费 agentId,进入后对话不绑定该智能体,故不适用。
        navigation.navigate('AiAssistantN8n', { agentId: item.id, title: item.name })
      }
      onPressCategory={(categoryId, title) =>
        navigation.navigate('CategoryDetail', { categoryId, title })
      }
      onBack={() => navigation.goBack()}
    />
  )
}
