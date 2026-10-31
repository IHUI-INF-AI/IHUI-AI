// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { useTt } from '@/i18n'

interface AgentDetailMetaProps {
  /** 创建者用户名;后端字段 userName 取不到时为空串 */
  creator: string
  /** 使用次数(GET /agents/list 的 usageCount);null = 本端没取到 ⇒ 显示「—」,不用 0 冒充 */
  uses: number | null
  /** 是否免费;null = 定价字段未取到(判不出就不显示价格) */
  isFree: boolean | null
  /** 价格,单位元(agents.price 整数元列;与共享屏 `¥${price.toFixed(2)}`、web 端同口径);null = 未取到 */
  price: number | null
}

/**
 * 智能体详情信息卡 —— 对齐共享屏 packages/app/src/features/agent-detail/AgentDetailScreen.tsx
 * 的 label/value 卡:创建者 / 使用次数 / 价格(免费走 agentDetail.free)。
 *
 * 「评分」一格不在本端呈现:agents 表没有评分列(packages/database/src/schema/agents-extended.ts
 * 现读只有 price/isFree/usageCount/likeCount/collectCount/userName),后端唯一的评分出口
 * /agent-reviews 只回"我自己名下智能体"收到的评价(apps/api/src/routes/agent-reviews.ts 的
 * where eq(agents.userId, userId))⇒ 访客拿不到本智能体的评分。原卡按 uses 反推一个 3.5~5.0 的
 * 数字上屏属于把假数据呈现给用户,已整格撤除,不做「显示 —」式保留(那是把不存在的维度摆上屏)。
 */
export default function AgentDetailMeta({ creator, uses, isFree, price }: AgentDetailMetaProps) {
  const tt = useTt()

  return (
    <View className="mx-[20rpx] mb-[24rpx] bg-card rounded-lg border border-border p-[28rpx]">
      <Text className="block text-caption text-muted-foreground">
        {tt('agentDetail.creator', '创建者')}
      </Text>
      <Text className="block text-strong text-foreground mt-[8rpx]">{creator || '—'}</Text>

      <Text className="block text-caption text-muted-foreground mt-[20rpx]">
        {tt('agentDetail.uses', '使用次数')}
      </Text>
      <Text className="block text-strong text-foreground mt-[8rpx]">
        {uses === null ? '—' : uses}
      </Text>

      <Text className="block text-caption text-muted-foreground mt-[20rpx]">
        {tt('agentDetail.price', '价格')}
      </Text>
      <Text className="block text-strong text-[var(--color-brand)] font-semibold mt-[8rpx]">
        {isFree === null || price === null
          ? '—'
          : isFree
            ? tt('agentDetail.free', '免费')
            : `¥${price.toFixed(2)}`}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
