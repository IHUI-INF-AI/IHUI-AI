import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  return (
    <View className="px-4 py-3">
      {content ? (
        <Text className="block text-sm text-foreground leading-relaxed">{content}</Text>
      ) : (
        <Text className="block text-sm text-muted-foreground">{tt('intro.empty', '暂无简介')}</Text>
      )}
      {agents.length > 0 && (
        <View className="mt-3 pt-3">
          <Text className="block text-xs text-muted-foreground mb-2">{tt('intro.relatedAI', '关联 AI 应用')}</Text>
          <View className="flex flex-wrap">
            {agents.map((agent) => (
              <View
                key={agent.id}
                className="mr-2 mb-1.5 px-2.5 py-1 rounded-md border border-indigo-100 bg-primary/10"
                onClick={() => onAgentClick?.(agent)}
              >
                <Text className="text-xs text-primary">{agent.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}
