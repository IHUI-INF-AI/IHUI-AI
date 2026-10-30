// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智汇值流水单条:对齐 packages/app/src/features/token-value/TokenValueScreen.tsx 的 recordItem 段
import { View, Text } from '@tarojs/components'
import { formatDateByTemplate } from '@ihui/shared'
import type { TtFn } from '@/i18n'
import { formatTokenValue } from './token-packages'

/** /token/records 回传的是 token_flows 原行(opType/quantity/remark/createdAt);
 *  agentName/title/token/amount 是旧后端字段,保留兜底,不删。 */
export interface ZhRecord {
  id?: string
  opType?: number
  quantity?: number
  balanceAfter?: number
  remark?: string
  createdAt?: string
  agentName?: string
  title?: string
  create_at?: string
  time?: string
  token?: number | string
  amount?: number
}

/** 净增口径与后端聚合同源(packages/database/src/schema/wallet.ts 表注 + user-extras 的
 *  getTokenFlowTotals):op_type ∈ {0 充值,3 退款,4 佣金,5 管理员调整,6 配额发放} 为净增,
 *  1 扣减 / 2 过期为净耗。旧判定只认 op_type===0,把退款/佣金/调整渲染成「消费 -N」= 错文案。
 *  缺字段(Number→NaN)仍按净耗收口(与旧页一致,不猜成净增)。 */
const GAIN_OP_TYPES = new Set([0, 3, 4, 5, 6])

interface TokenRecordProps {
  item: ZhRecord
  tt: TtFn
}

/** 单条流水:类型徽章(充值/消费)+ 标题 + 时间 + 金额,与共享屏同信息层级 */
export default function TokenRecord({ item, tt }: TokenRecordProps) {
  const isRecharge = GAIN_OP_TYPES.has(Number(item.opType))
  const qty = Math.abs(Number(item.quantity ?? item.token ?? item.amount ?? 0))
  const typeLabel = isRecharge
    ? tt('tokenValue.tab.recharge', '充值')
    : tt('tokenValue.tab.cost', '消费')
  const title = item.agentName || item.title || item.remark || typeLabel
  const rawTime = item.create_at || item.createdAt || item.time || ''
  const time = formatDateByTemplate(rawTime, 'MM-DD HH:mm') || rawTime

  return (
    <View className="record-item">
      <View className="flex items-center">
        <Text
          className={`mr-[16rpx] shrink-0 px-[12rpx] py-[2rpx] rounded-md text-[length:20rpx] font-semibold ${
            isRecharge
              ? 'bg-[var(--color-success-light)] text-[var(--color-success-deep-text)]'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {typeLabel}
        </Text>
        <Text className="record-title flex-1 min-w-0">{title}</Text>
      </View>
      <View className="record-content">
        <Text className="record-time">
          {tt('token.balance.costTime', '花费时间:')}
          {time}
        </Text>
        <Text className="record-count">
          {isRecharge ? '+' : '-'}
          {formatTokenValue(qty)}
        </Text>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
