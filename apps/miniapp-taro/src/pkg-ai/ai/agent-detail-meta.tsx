// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'

interface AgentDetailMetaProps {
  /** 创建者用户名;后端字段 userName 取不到时为空串 */
  creator: string
  /** 使用次数(getAgentList 的 usageCount) */
  uses: number
  /** 评分(uses 推算,与页面既有 estimateRating 同源) */
  rating: number
  /** 是否免费;null = 定价字段未取到(判不出就不显示价格) */
  isFree: boolean | null
  /** 价格,单位分;null = 未取到 */
  price: number | null
}

/**
 * 智能体详情信息卡 —— 对齐共享屏 packages/app/src/features/agent-detail/AgentDetailScreen.tsx
 * 的 label/value 卡:创建者 / 使用次数 / 评分 / 价格(免费走 agentDetail.free)。
 */
export default function AgentDetailMeta({
  creator,
  uses,
  rating,
  isFree,
  price,
}: AgentDetailMetaProps) {
  const tt = useTt()

  return (
    <View className="mx-[20rpx] mb-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
      <Text className="block text-[length:22rpx] text-muted-foreground">
        {tt('agentDetail.creator', '创建者')}
      </Text>
      <Text className="block text-[length:30rpx] text-foreground mt-[8rpx]">{creator || '—'}</Text>

      <Text className="block text-[length:22rpx] text-muted-foreground mt-[20rpx]">
        {tt('agentDetail.uses', '使用次数')}
      </Text>
      <Text className="block text-[length:30rpx] text-foreground mt-[8rpx]">{uses}</Text>

      <Text className="block text-[length:22rpx] text-muted-foreground mt-[20rpx]">
        {tt('agentDetail.rating', '评分')}
      </Text>
      <View className="flex items-center mt-[8rpx]">
        <LineIcon
          name="star-fill"
          size={22}
          color="var(--color-warning-amber)"
          className="mr-[6rpx]"
        />
        <Text className="text-[length:30rpx] text-foreground">{rating.toFixed(1)}</Text>
      </View>

      <Text className="block text-[length:22rpx] text-muted-foreground mt-[20rpx]">
        {tt('agentDetail.price', '价格')}
      </Text>
      <Text className="block text-[length:30rpx] text-[var(--color-brand)] font-semibold mt-[8rpx]">
        {isFree === null || price === null
          ? '—'
          : isFree
            ? tt('agentDetail.free', '免费')
            : `¥${(price / 100).toFixed(2)}`}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
