import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useReady } from '@tarojs/taro'
import { getAgentDetail } from '@/api'
import './agent-detail.css'

interface AgentDetail {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
  config?: Record<string, any>
}

export default function AgentDetailPage() {
  const [agent, setAgent] = useState<AgentDetail>({} as AgentDetail)

  useReady(async () => {
    const params = Taro.getCurrentInstance().router?.params
    if (!params?.id) return
    try { setAgent(await getAgentDetail(params.id)) } catch (e) {}
  })

  const onChat = useCallback(() => {
    Taro.navigateTo({ url: `/pages/ai/chat?agentId=${agent.id}` })
  }, [agent.id])

  return (
    <View className="page">
      {agent.name ? (
        <View className="head">
          <Image className="avatar" src={agent.avatar || '/static/default-agent.png'} mode="aspectFill" />
          <View className="info">
            <Text className="name">{agent.name}</Text>
            <Text className="desc">{agent.desc}</Text>
          </View>
        </View>
      ) : null}
      {agent.prompt ? (
        <View className="card">
          <View className="card-title">Agent提示词</View>
          <Text className="prompt">{agent.prompt}</Text>
        </View>
      ) : null}
      {agent.config ? (
        <View className="card">
          <View className="card-title">配置信息</View>
          {Object.entries(agent.config).map(([k, v]) => (
            <View key={k} className="row">
              <Text className="label">{k}</Text>
              <Text className="value">{String(v)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {agent.name ? <Button className="btn" onClick={onChat}>开始对话</Button> : null}
    </View>
  )
}
