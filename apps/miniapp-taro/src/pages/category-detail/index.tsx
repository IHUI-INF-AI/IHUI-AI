import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAgentList } from '@/api'
import { useI18n } from '@/i18n'

interface AgentItem {
  id: string | number
  name: string
  desc?: string
  avatar?: string
  uses?: number
  tags?: string[]
}

type SortType = 'hot' | 'new'

export default function CategoryDetailPage() {
  const { t } = useI18n()
  const [list, setList] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortType>('hot')
  const [categoryId, setCategoryId] = useState('')

  const load = useCallback(async () => {
    const pages = Taro.getCurrentPages()
    const current = pages[pages.length - 1]
    const id = (current?.options?.id || current?.options?.categoryId || '') as string
    setCategoryId(id)
    setLoading(true)
    try {
      const res = (await getAgentList()) as { list?: AgentItem[] }
      let agents = res?.list || []
      if (sort === 'hot') {
        agents = [...agents].sort((a, b) => (b.uses || 0) - (a.uses || 0))
      } else {
        agents = [...agents].reverse()
      }
      setList(agents)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sort])

  useDidShow(load)

  const handleSelect = (agent: AgentItem) => {
    Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${agent.id}` })
  }

  const toggleSort = () => {
    setSort(sort === 'hot' ? 'new' : 'hot')
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="flex items-center justify-between px-4 py-3 bg-card">
        <Text className="text-sm text-muted-foreground">
          {categoryId
            ? t('categoryDetail.categoryId', { id: categoryId })
            : t('categoryDetail.allCategories')}
        </Text>
        <View className="flex items-center px-3 py-1 rounded-md bg-muted" onClick={toggleSort}>
          <Text className="text-xs text-foreground">
            {sort === 'hot' ? t('categoryDetail.hot') : t('categoryDetail.new')}
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="px-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="flex items-center py-3 animate-pulse">
              <View className="w-12 h-12 mr-3 rounded-xl bg-muted" />
              <View className="flex-1 space-y-2">
                <View className="h-3 w-1/3 rounded bg-muted" />
                <View className="h-2.5 w-2/3 rounded bg-muted" />
              </View>
            </View>
          ))}
        </View>
      ) : list.length === 0 ? (
        <View className="flex items-center justify-center py-16">
          <Text className="text-sm text-muted-foreground">{t('categoryDetail.empty')}</Text>
        </View>
      ) : (
        <View className="px-3 py-2">
          {list.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center py-3 px-3 mb-2 bg-card rounded-lg"
              onClick={() => handleSelect(agent)}
            >
              {agent.avatar ? (
                <Image
                  className="w-12 h-12 mr-3 rounded-xl bg-muted"
                  src={agent.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-xl bg-muted">
                  <Text className="text-base font-medium text-muted-foreground">
                    {agent.name.charAt(0)}
                  </Text>
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="block text-sm font-medium text-foreground truncate">
                  {agent.name}
                </Text>
                <Text className="block text-xs text-muted-foreground truncate mt-0.5">
                  {agent.desc || t('categoryDetail.noDesc')}
                </Text>
                {agent.tags && agent.tags.length > 0 && (
                  <View className="flex flex-wrap mt-1">
                    {agent.tags.slice(0, 2).map((tag, i) => (
                      <Text
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 mr-1 rounded bg-muted text-muted-foreground"
                      >
                        {tag}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              {agent.uses !== undefined && (
                <Text className="text-xs text-muted-foreground ml-2">
                  {t('categoryDetail.useCount', { n: agent.uses })}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
