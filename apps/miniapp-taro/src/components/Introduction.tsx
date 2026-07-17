import { View, Text } from '@tarojs/components'

export interface AgentRef {
  id: string
  name: string
}

export interface IntroductionProps {
  content?: string
  agents?: AgentRef[]
  onAgentClick?: (agent: AgentRef) => void
}

export default function Introduction({
  content = '',
  agents = [],
  onAgentClick,
}: IntroductionProps) {
  return (
    <View className="px-4 py-3">
      {content ? (
        <Text className="block text-sm text-gray-600 leading-relaxed">{content}</Text>
      ) : (
        <Text className="block text-sm text-gray-400">暂无简介</Text>
      )}
      {agents.length > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-50">
          <Text className="block text-xs text-gray-400 mb-2">关联 AI 应用</Text>
          <View className="flex flex-wrap">
            {agents.map((agent) => (
              <View
                key={agent.id}
                className="mr-2 mb-1.5 px-2.5 py-1 rounded-md border border-indigo-100 bg-indigo-50"
                onClick={() => onAgentClick?.(agent)}
              >
                <Text className="text-xs text-indigo-500">{agent.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
