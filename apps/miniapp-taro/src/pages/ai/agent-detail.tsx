import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAgentDetail } from '@/api'

interface AgentDetail {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
  config?: Record<string, unknown>
}

export default function AgentDetailPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<AgentDetail | null>(null)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    try {
      setAgent(await getAgentDetail(id))
    } catch (e) {
      console.error('[ai/agent-detail] 获取Agent详情 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [router.params.id])

  useDidShow(() => {
    load()
  })

  const onChat = useCallback(() => {
    if (!agent) return
    Taro.navigateTo({ url: `/pages/ai/chat?agentId=${agent.id}` })
  }, [agent])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {agent && (
        <View className="mx-[12px] my-[12px] bg-white rounded-[8px] p-[16px]">
          <View className="flex items-center">
            <Image
              className="w-[80px] h-[80px] rounded-full bg-[#f5f5f5]"
              src={agent.avatar || '/static/default-agent.png'}
              mode="aspectFill"
            />
            <View className="ml-[12px] flex-1">
              <Text className="text-[18px] text-[#333] font-bold">{agent.name}</Text>
              <Text className="block text-[14px] text-[#666] mt-[4px]">{agent.desc}</Text>
            </View>
          </View>
        </View>
      )}
      {agent?.prompt && (
        <View className="mx-[12px] mb-[12px] bg-[#f5f5f5] rounded-[8px] p-[16px]">
          <Text className="text-[14px] text-[#333] font-semibold mb-[8px] block">Agent提示词</Text>
          <Text className="text-[14px] text-[#666] leading-[22px]">{agent.prompt}</Text>
        </View>
      )}
      {agent && (
        <View className="mx-[12px] my-[12px]">
          <Button
            className="w-full bg-[#07c160] text-white text-[16px] rounded-[8px] h-[44px] leading-[44px]"
            onClick={onChat}
          >
            开始对话
          </Button>
        </View>
      )}
    </View>
  )
}
