import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAgentList } from '@/api'

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
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="flex items-center justify-between px-4 py-3 bg-white">
        <Text className="text-sm text-gray-500">
          {categoryId ? `分类ID: ${categoryId}` : '全部分类'}
        </Text>
        <View className="flex items-center px-3 py-1 rounded-full bg-gray-50" onClick={toggleSort}>
          <Text className="text-xs text-gray-600">{sort === 'hot' ? '🔥 最热' : '✨ 最新'}</Text>
        </View>
      </View>

      {loading ? (
        <View className="px-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} className="flex items-center py-3 animate-pulse">
              <View className="w-12 h-12 mr-3 rounded-xl bg-gray-100" />
              <View className="flex-1 space-y-2">
                <View className="h-3 w-1/3 rounded bg-gray-100" />
                <View className="h-2.5 w-2/3 rounded bg-gray-100" />
              </View>
            </View>
          ))}
        </View>
      ) : list.length === 0 ? (
        <View className="flex items-center justify-center py-16">
          <Text className="text-sm text-gray-400">暂无Agent</Text>
        </View>
      ) : (
        <View className="px-3 py-2">
          {list.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center py-3 px-3 mb-2 bg-white rounded-lg"
              onClick={() => handleSelect(agent)}
            >
              {agent.avatar ? (
                <Image
                  className="w-12 h-12 mr-3 rounded-xl bg-gray-50"
                  src={agent.avatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="flex items-center justify-center w-12 h-12 mr-3 rounded-xl bg-gray-50">
                  <Text className="text-base font-medium text-gray-500">
                    {agent.name.charAt(0)}
                  </Text>
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="block text-sm font-medium text-gray-800 truncate">
                  {agent.name}
                </Text>
                <Text className="block text-xs text-gray-400 truncate mt-0.5">
                  {agent.desc || '暂无描述'}
                </Text>
                {agent.tags && agent.tags.length > 0 && (
                  <View className="flex flex-wrap mt-1">
                    {agent.tags.slice(0, 2).map((tag, i) => (
                      <Text
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 mr-1 rounded bg-gray-50 text-gray-500"
                      >
                        {tag}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
              {agent.uses !== undefined && (
                <Text className="text-xs text-gray-400 ml-2">{agent.uses}次</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
