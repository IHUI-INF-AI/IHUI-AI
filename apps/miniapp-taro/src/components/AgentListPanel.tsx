import { View, Text, ScrollView, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import type { Agent } from '@ihui/api-client'
import EmptyState from './EmptyState'
import { useTt } from '@/i18n'
// 原项目 AgentList.vue 头像兜底图标(本地副本 import,对齐 zhs_app-ZZ)
import mianLabelIcon from '@/assets/remote/images/mian_label.png'

/** VIP 标签类型(对齐原项目 Ai-list_b.vue L43-64):1=会员免费 / 2=免费使用 / 3=限时免费 / 4=月费 / 5=已购买 */
export type VipType = 1 | 2 | 3 | 4 | 5

export type AgentInfo = Pick<Agent, 'id' | 'name'> & {
  description?: string
  /** @deprecated 使用 description 替代,兼容 agent.tsx 旧字段名 */
  desc?: string
  avatar?: string
  category?: string
  useCount?: number
  /** @deprecated 使用 useCount 替代,兼容 agent.tsx 旧字段名 */
  uses?: number
  isVipExclusive?: boolean
  /** VIP 标签类型:1=会员免费 / 2=免费使用 / 3=限时免费 / 4=月费 / 5=已购买 */
  vipType?: VipType
  /** 价格(vipType=4 月费显示),单位:分 */
  price?: number
}

export interface AgentListPanelProps {
  visible?: boolean
  agents?: AgentInfo[]
  loading?: boolean
  onSelect?: (agent: AgentInfo) => void
  /** 购买回调(vipType=4 月费时点击触发,替代 onSelect) */
  onPurchase?: (agent: AgentInfo) => void
}

/** VIP 标签文案(对齐原项目 Ai-list_b.vue L43-64) */
const VIP_TAG_LABELS: Record<VipType, string> = {
  1: '会员免费',
  2: '免费使用',
  3: '限时免费',
  4: '月费',
  5: '已购买',
}

/** VIP 标签样式(对齐原项目配色:金/绿/橙/蓝/灰) */
const VIP_TAG_STYLES: Record<VipType, CSSProperties> = {
  1: { background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' },
  2: { background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  3: { background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' },
  4: { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' },
  5: { background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af' },
}

/** 价格格式化(分 → 元,如 990 → "9.9",1000 → "10") */
function formatPrice(cents: number): string {
  return String(parseFloat((cents / 100).toFixed(2)))
}

export default function AgentListPanel({
  visible = false,
  agents = [],
  loading = false,
  onSelect,
  onPurchase,
}: AgentListPanelProps) {
  const tt = useTt()
  if (!visible) return null

  const handleAgentClick = (agent: AgentInfo) => {
    if (agent.vipType === 4 && onPurchase) {
      onPurchase(agent)
    } else {
      onSelect?.(agent)
    }
  }

  return (
    <View className="bg-card rounded-t-2xl shadow-lg" style={{ maxHeight: '50vh' }}>
      <View className="flex items-center justify-between px-4 py-3 mb-2">
        <Text className="text-sm font-medium text-foreground">{tt('agent.title', '智能体')}</Text>
      </View>
      <ScrollView scrollY className="" style={{ maxHeight: '40vh' }}>
        <View className="px-3 py-2">
          {loading ? (
            <View className="py-8 text-center">
              <Text className="text-sm text-muted-foreground">
                {tt('common.loadingShort', '加载中...')}
              </Text>
            </View>
          ) : agents.length === 0 ? (
            <EmptyState text={tt('agent.empty', '暂无智能体')} />
          ) : (
            agents.map((agent) => (
              <View
                key={agent.id}
                className="flex items-center py-2.5 px-3 mb-2 rounded-lg bg-muted"
                onClick={() => handleAgentClick(agent)}
              >
                <Image
                  className="w-10 h-10 mr-3 rounded-xl bg-muted"
                  src={agent.avatar || mianLabelIcon}
                  mode="aspectFill"
                />
                <View className="flex-1 min-w-0">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground truncate">
                      {agent.name}
                    </Text>
                    {agent.vipType ? (
                      <Text
                        className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded font-medium"
                        style={VIP_TAG_STYLES[agent.vipType]}
                      >
                        {VIP_TAG_LABELS[agent.vipType]}
                        {agent.vipType === 4 && agent.price
                          ? ` ¥${formatPrice(agent.price)}/月`
                          : ''}
                      </Text>
                    ) : agent.isVipExclusive ? (
                      <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                        VIP
                      </Text>
                    ) : null}
                    {agent.category && (
                      <Text className="ml-2 text-[20rpx] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        {agent.category}
                      </Text>
                    )}
                  </View>
                  {agent.description && (
                    <Text className="block text-xs text-muted-foreground truncate">
                      {agent.description}
                    </Text>
                  )}
                </View>
                {agent.useCount !== undefined && (
                  <Text className="text-xs text-muted-foreground ml-2">
                    {agent.useCount}
                    {tt('agent.uses', '次')}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  )
}
