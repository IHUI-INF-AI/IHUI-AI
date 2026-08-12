/**
 * RecentAgents — 最近使用的智能体横向滚动列表
 * 对齐原项目 zhs_app-ZZ Ai-WXMiniVue tools/components/RecentAgents.vue
 */
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

export interface RecentAgent {
  id: string
  agentName: string
  agentAvatar: string
  /** 可选:智能体类型 3/5 为付费模型,点击时跳过跳转 */
  type?: number
  /** 可选:来源标识,如 'n8n' 跳转专用页面 */
  source?: string
  agentId?: string
}

export interface RecentAgentsProps {
  recentAgents: RecentAgent[]
}

export default function RecentAgents({ recentAgents }: RecentAgentsProps) {
  if (!recentAgents || recentAgents.length === 0) return null

  function navigateTo(agent: RecentAgent, idx: number) {
    const userData = Taro.getStorageSync('data') as Record<string, unknown> | null
    if (!userData) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (agent.type === 3 || agent.type === 5) {
      return
    }
    const targetUrl = agent.source === 'n8n'
      ? '/pages/tools/ai_assistant_n8n'
      : '/pages/tools/ai_assistant'
    const agentId = agent.agentId || agent.id
    Taro.navigateTo({
      url: `${targetUrl}?modelNamea=${encodeURIComponent(agent.agentName)}&pitcha=${idx}&agentId=${encodeURIComponent(agentId)}&type=${agent.type ?? ''}`,
    })
  }

  return (
    <View className="recent-agents-container">
      <View className="recent-header">
        <Text className="recent-title">最近使用</Text>
      </View>
      <ScrollView scrollX className="recent-scroll" showScrollbar={false}>
        <View className="recent-list">
          {recentAgents.map((agent, index) => (
            <View
              key={agent.id || index}
              className="recent-item"
              onClick={() => navigateTo(agent, index)}
              style={{ borderRadius: '25rpx' }}
            >
              {agent.agentAvatar ? (
                <Image
                  className="agent-avatar"
                  src={agent.agentAvatar}
                  mode="aspectFill"
                />
              ) : (
                <View className="agent-avatar agent-avatar-fallback">
                  <Text className="agent-avatar-fallback-text">
                    {(agent.agentName || '?').charAt(0)}
                  </Text>
                </View>
              )}
              <Text className="agent-name">{agent.agentName}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}