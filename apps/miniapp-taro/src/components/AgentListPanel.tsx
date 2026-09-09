// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, type TtFn } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import type { Agent } from '@ihui/api-client'
import EmptyState from './EmptyState'
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
const VIP_TAG_LABELS = (tt: TtFn): Record<VipType, string> => ({
  1: tt('pay.memberFree', '会员免费'),
  2: tt('AgentListPanel.d1', '免费使用'),
  3: tt('devEnter.modelEdit.saleTypeLimited', '限时免费'),
  4: tt('AgentListPanel.d2', '月费'),
  5: tt('AgentListPanel.d3', '已购买'),
})

/** VIP 标签样式(对齐原项目配色语义 金/绿/橙/蓝/灰,统一改用 design token CSS 变量,禁止色板硬编码) */
const VIP_TAG_CLASSES: Record<VipType, string> = {
  1: 'bg-[var(--color-gold-muted)] text-[var(--color-gold)]',
  2: 'bg-[var(--color-success-tint)] text-[var(--color-success)]',
  3: 'bg-[var(--color-brand-orange-tint)] text-[var(--color-brand-orange)]',
  4: 'bg-[var(--color-info-tint)] text-[var(--color-info)]',
  5: 'bg-[var(--color-black-6)] text-[var(--color-muted-foreground)]',
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
    <View
      className={isSheet ? 'bg-card rounded-t-2xl shadow-lg' : 'bg-transparent'}
      style={isSheet ? { maxHeight: '50vh' } : undefined}
    >
      {/* RN 共享 AgentScreen 无面板内标题,仅 sheet 形态保留 */}
      {isSheet ? (
        <View className="flex items-center justify-between px-4 py-3 mb-2">
          <Text className="text-sm font-medium text-foreground">{tt('agent.title', '智能体')}</Text>
        </View>
      ) : null}
      <ScrollView scrollY style={isSheet ? { maxHeight: '40vh' } : undefined}>
        <View className={isSheet ? 'px-3 py-2' : ''}>
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
              /* 对齐 RN 共享 AgentScreen card: padding 14dp→28rpx / borderRadius 12dp→24rpx /
                 border border.light / bg surface.light(card) */
              <View
                key={agent.id}
                className="flex items-center py-[28rpx] px-[28rpx] mb-[24rpx] rounded-[24rpx] bg-[var(--color-card)] border border-[var(--color-border)]"
                onClick={() => handleAgentClick(agent)}
              >
                {/* RN avatar 48dp→96rpx / borderRadius 12dp→24rpx / bg surface.muted;cardMain marginLeft 12dp→24rpx */}
                <Image
                  className="w-[96rpx] h-[96rpx] mr-[24rpx] rounded-[24rpx] bg-[var(--color-muted)] shrink-0"
                  src={agent.avatar || mianLabelIcon}
                  mode="aspectFill"
                />
                <View className="flex-1 min-w-0">
                  {/* RN nameRow gap 6dp→12rpx;name fontSize 16dp→32rpx / fontWeight 600 / flex 1 */}
                  <View className="flex items-center gap-[12rpx]">
                    <Text className="text-[32rpx] font-semibold text-foreground truncate flex-1">
                      {agent.name}
                    </Text>
                    {agent.vipType ? (
                      <Text
                        className={`shrink-0 text-[20rpx] px-[12rpx] py-[8rpx] rounded-[8rpx] font-semibold ${VIP_TAG_CLASSES[agent.vipType]}`}
                      >
                        {VIP_TAG_LABELS(tt)[agent.vipType]}
                        {agent.vipType === 4 && agent.price
                          ? ` ¥${formatPrice(agent.price)}/月`
                          : ''}
                      </Text>
                    ) : agent.isVipExclusive ? (
                      /* RN vipBadge: bg warning.DEFAULT / 字 warning-foreground(surface.light) */
                      <Text className="shrink-0 text-[20rpx] px-[12rpx] py-[8rpx] rounded-[8rpx] font-semibold bg-[var(--color-warning)] text-[var(--color-warning-foreground)]">
                        VIP
                      </Text>
                    ) : null}
                    {agent.category && (
                      <Text className="shrink-0 text-[20rpx] px-[12rpx] py-[8rpx] rounded-[8rpx] bg-[var(--color-black-10)] text-[var(--color-primary)]">
                        {agent.category}
                      </Text>
                    )}
                  </View>
                  {/* RN desc marginTop 8dp→16rpx / fontSize 14dp→28rpx / color text.secondary */}
                  {agent.description && (
                    <Text className="block text-[28rpx] text-muted-foreground truncate mt-[16rpx]">
                      {agent.description}
                    </Text>
                  )}
                </View>
                {/* RN meta fontSize 11dp→22rpx / color text.tertiary */}
                {agent.useCount !== undefined && (
                  <Text className="shrink-0 text-[22rpx] text-[var(--color-text-tertiary)] ml-[16rpx]">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
