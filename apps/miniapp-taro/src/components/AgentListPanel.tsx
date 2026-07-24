import { View, Text, ScrollView, Image } from '@tarojs/components'
import EmptyState from './EmptyState'
import { useI18n } from '@/i18n'

export interface AgentInfo {
  id: string
  name: string
  desc?: string
  avatar?: string
  category?: string
  uses?: number
  isVipExclusive?: boolean
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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!visible) return null

  return (
    <View className="bg-card rounded-t-2xl shadow-lg" style={{ maxHeight: '50vh' }}>
      <View className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Text className="text-sm font-medium text-foreground">{tt('agent.title', '智能体')}</Text>
      </View>
      <ScrollView scrollY className="px-3 py-2" style={{ maxHeight: '40vh' }}>
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">{tt('common.loadingShort', '加载中...')}</Text>
          </View>
        ) : agents.length === 0 ? (
          <EmptyState text={tt('agent.empty', '暂无智能体')} />
        ) : (
          agents.map((agent) => (
            <View
              key={agent.id}
              className="flex items-center py-2.5 px-3 mb-2 rounded-lg bg-muted"
              onClick={() => onSelect?.(agent)}
            >
              <Image
                className="w-10 h-10 mr-3 rounded-xl bg-muted"
                src={agent.avatar || '/static/default-agent.png'}
                mode="aspectFill"
              />
              <View className="flex-1 min-w-0">
                <View className="flex items-center">
                  <Text className="text-sm font-medium text-foreground truncate">{agent.name}</Text>
                  {agent.isVipExclusive && (
                    <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                      VIP
                    </Text>
                  )}
                  {agent.category && (
                    <Text className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {agent.category}
                    </Text>
                  )}
                </View>
                {agent.desc && (
                  <Text className="block text-xs text-muted-foreground truncate">{agent.desc}</Text>
                )}
              </View>
              {agent.uses !== undefined && (
                <Text className="text-xs text-muted-foreground ml-2">{agent.uses}{tt('agent.uses', '次')}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
