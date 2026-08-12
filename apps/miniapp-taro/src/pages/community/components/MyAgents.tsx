/**
 * MyAgents — 我的AI APP 横向滚动列表 + "我的AI员工"团队按钮
 * 对齐原项目 zhs_app-ZZ Ai-WXMiniVue tools/components/MyAgents.vue
 */
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

export interface MyAgent {
  id: string
  agentName: string
  agentAvatar: string
  /** 可选:智能体类型 3/5 为付费模型,点击时跳过跳转 */
  type?: number
  /** 可选:来源标识,如 'n8n' 跳转专用页面 */
  source?: string
  agentId?: string
}

export interface MyAgentsProps {
  myAgents: MyAgent[]
}

export default function MyAgents({ myAgents }: MyAgentsProps) {
  if (!myAgents || myAgents.length === 0) return null

  function goToTeam() {
    Taro.navigateTo({ url: '/pages/tools/ai_group/index' })
  }

  function navigateTo(agent: MyAgent, idx: number) {
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
    <View className="my-agents-container">
      <View className="my-header">
        <Text className="my-title">我的AI APP</Text>
        <View className="team-button" onClick={goToTeam}>
          <Text className="team-button-text">我的AI员工</Text>
          <Text className="team-button-arrow">{'>'}</Text>
        </View>
      </View>
      <ScrollView scrollX className="my-scroll" showScrollbar={false}>
        <View className="my-list">
          {myAgents.map((agent, index) => (
            <View
              key={agent.id || index}
              className="my-item"
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