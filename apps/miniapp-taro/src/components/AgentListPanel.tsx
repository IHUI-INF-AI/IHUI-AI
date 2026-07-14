import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'

export interface AgentInfo {
  id: string
  name: string
  desc?: string
  avatar?: string
  category?: string
  uses?: number
}

export interface AgentListPanelProps {
  visible?: boolean
  agents?: AgentInfo[]
  loading?: boolean
  onSelect?: (agent: AgentInfo) => void
}

export default function AgentListPanel({
  visible = false,
  agents = [],
  loading = false,
  onSelect,
}: AgentListPanelProps) {
  if (!visible) return null

  return (
    <View className="bg-white rounded-t-2xl shadow-lg" style={{ maxHeight: '50vh' }}>
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-800">智能体</Text>
      </View>
      <ScrollView scrollY className="px-3 py-2" style={{ maxHeight: '40vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : agents.length === 0 ? (
          <EmptyState text="暂无智能体" />
        ) : (
          agents.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center py-2.5 px-3 mb-2 rounded-lg bg-gray-50"
              onClick={() => onSelect?.(agent)}
            >
              <Image
                className="w-10 h-10 mr-3 rounded-xl bg-gray-100"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="flex-1 min-w-0">
                <View className="flex items-center">
                  <Text className="text-sm font-medium text-gray-800 truncate">{agent.name}</Text>
                  {agent.category && (
                    <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">
                      {agent.category}
                    </Text>
                  )}
                </View>
                {agent.desc && (
                  <Text className="block text-xs text-gray-400 truncate">{agent.desc}</Text>
                )}
              </View>
              {agent.uses !== undefined && (
                <Text className="text-xs text-gray-400 ml-2">{agent.uses}次</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
