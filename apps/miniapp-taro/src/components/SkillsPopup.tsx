import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'

export interface AgentItem {
  id: string
  name: string
  desc?: string
  avatar?: string
  uses?: number
}

export interface SkillsPopupProps {
  visible?: boolean
  agents?: AgentItem[]
  loading?: boolean
  onSelect?: (agent: AgentItem) => void
  onClose?: () => void
}

export default function SkillsPopup({
  visible = false,
  agents = [],
  loading = false,
  onSelect,
  onClose,
}: SkillsPopupProps) {
  if (!visible) return null

  return (
    <View
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg"
      style={{ maxHeight: '60vh' }}
    >
      <View className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-sm font-medium text-gray-800">技能商店</Text>
        <Text className="text-sm text-gray-400" onClick={onClose}>
          关闭
        </Text>
      </View>
      <ScrollView scrollY className="px-3 py-2" style={{ maxHeight: '50vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-gray-400">加载中...</Text>
          </View>
        ) : agents.length === 0 ? (
          <EmptyState text="暂无技能" />
        ) : (
          agents.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center py-2.5 px-3 mb-2 rounded-lg bg-gray-50"
              onClick={() => onSelect?.(agent)}
            >
              <Image
                className="w-10 h-10 mr-3 rounded-full bg-gray-100"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="flex-1 min-w-0">
                <Text className="block text-sm font-medium text-gray-800 truncate">
                  {agent.name}
                </Text>
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
