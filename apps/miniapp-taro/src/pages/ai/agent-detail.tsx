import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAgentDetail, getAgentPermission, type AgentPermission } from '@/api'
import { useI18n } from '@/i18n'

interface AgentDetail {
  id: string
  name: string
  desc: string
  avatar?: string
  prompt: string
  config?: Record<string, unknown>
  isVipExclusive?: boolean
}

const PERMISSION_REASON_KEY: Record<string, string> = {
  free: 'ai.agentDetail.reasonFree',
  vip: 'ai.agentDetail.reasonVip',
  purchased: 'ai.agentDetail.reasonPurchased',
  vip_only: 'ai.agentDetail.reasonVipOnly',
  paid: 'ai.agentDetail.reasonVip',
}

export default function AgentDetailPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [agent, setAgent] = useState<AgentDetail | null>(null)
  const [permission, setPermission] = useState<AgentPermission | null>(null)
  const [permLoading, setPermLoading] = useState(false)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    try {
      setAgent(await getAgentDetail(id))
    } catch (e) {
      logger.error('ai/agent-detail', '获取Agent详情', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
    // 调用 getAgentPermission 校验权限
    setPermLoading(true)
    try {
      const perm = await getAgentPermission(id)
      setPermission(perm)
    } catch (e) {
      logger.warn(
        'ai/agent-detail',
        '获取Agent权限失败',
        e instanceof Error ? e.message : String(e),
      )
    } finally {
      setPermLoading(false)
    }
  }, [router.params.id, t])

  useDidShow(() => {
    load()
  })

  const onChat = useCallback(() => {
    if (!agent) return
    // VIP 权限校验未通过时拦截
    if (agent.isVipExclusive && permission && !permission.hasPermission) {
      Taro.showToast({ title: t('ai.agentDetail.vipPermissionDenied'), icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/ai/chat?agentId=${agent.id}` })
  }, [agent, permission, t])

  const permReasonKey =
    permission?.type && PERMISSION_REASON_KEY[permission.type]
      ? PERMISSION_REASON_KEY[permission.type]
      : null

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      {agent && (
        <View className="mx-[12px] my-[12px] bg-white rounded-[8px] p-[16px]">
          <View className="flex items-center">
            <Image
              className="w-[80px] h-[80px] rounded-md bg-[#f5f5f5]"
              src={agent.avatar || '/static/default-agent.png'}
              mode="aspectFill"
            />
            <View className="ml-[12px] flex-1">
              <View className="flex items-center">
                <Text className="text-[18px] text-[#333] font-bold">{agent.name}</Text>
                {agent.isVipExclusive && (
                  <Text className="ml-[8px] text-[11px] px-[6px] py-[2px] rounded bg-amber-50 text-amber-600">
                    {t('ai.agentDetail.vipExclusive')}
                  </Text>
                )}
              </View>
              <Text className="block text-[14px] text-[#666] mt-[4px]">{agent.desc}</Text>
            </View>
          </View>
          {/* VIP 权限校验状态 */}
          {permLoading ? (
            <View className="mt-[12px] py-[8px] px-[10px] rounded bg-gray-50">
              <Text className="text-[12px] text-gray-500">
                {t('ai.agentDetail.permissionLoading')}
              </Text>
            </View>
          ) : permission ? (
            <View
              className={`mt-[12px] py-[8px] px-[10px] rounded ${
                permission.hasPermission ? 'bg-emerald-50' : 'bg-amber-50'
              }`}
            >
              <Text
                className={`text-[12px] ${
                  permission.hasPermission ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {permission.hasPermission
                  ? t('ai.agentDetail.permissionAllowed')
                  : t('ai.agentDetail.permissionDenied')}
                {permReasonKey ? ` · ${t(permReasonKey)}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
      )}
      {agent?.prompt && (
        <View className="mx-[12px] mb-[12px] bg-[#f5f5f5] rounded-[8px] p-[16px]">
          <Text className="text-[14px] text-[#333] font-semibold mb-[8px] block">
            {t('ai.agentDetail.promptLabel')}
          </Text>
          <Text className="text-[14px] text-[#666] leading-[22px]">{agent.prompt}</Text>
        </View>
      )}
      {agent && (
        <View className="mx-[12px] my-[12px]">
          <Button
            className="w-full bg-[var(--color-primary)] text-white text-[16px] rounded-[8px] h-[44px] leading-[44px]"
            onClick={onChat}
          >
            {t('ai.agentDetail.startChat')}
          </Button>
        </View>
      )}
    </View>
  )
}
