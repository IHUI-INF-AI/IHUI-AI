// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, t } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import EmptyState from './EmptyState'
import LineIcon from '@/components/LineIcon'
// G-815963/966:值域判定的唯一出口(纯呈现域用 narrowKnown,未知走独立档不冒充已知)。
import { narrowKnown } from '@ihui/types'

export interface WithdrawalRecord {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  method?: string
  createdAt?: string
  processedAt?: string
  remark?: string
}

export interface WithdrawalRecordsProps {
  records?: WithdrawalRecord[]
  loading?: boolean
  onViewDetail?: (record: WithdrawalRecord) => void
  onReachBottom?: () => void
}

/**
 * G-815966:提现状态全集 + 以它为键的**完备**展示表。
 *
 * 旧形态是 `Record<string, …>` + `STATUS_MAP[record.status] ?? {…}` —— 键域开放意味着
 * 「新增一档忘了配展示」在编译层完全不红(表永远"合法"),而 `??` 又把漏配静默成一条兜底文案。
 * 现改为 `Record<WithdrawalDisplayStatus, …>`:漏一档 = TS 错误(票面要的正是这一条)。
 */
const WITHDRAWAL_DISPLAY_STATUSES = ['pending', 'approved', 'rejected', 'completed'] as const
type WithdrawalDisplayStatus = (typeof WITHDRAWAL_DISPLAY_STATUSES)[number]

const STATUS_MAP: Record<WithdrawalDisplayStatus, { label: string; color: string }> = {
  pending: { label: t('order.refundList.stepReview'), color: 'text-warning' },
  approved: { label: t('exam.passed'), color: 'text-primary' },
  rejected: { label: t('WithdrawalRecords.d1'), color: 'text-destructive' },
  completed: { label: t('plaza.index.tabDone'), color: 'text-primary' },
}

/**
 * 未知档的显式声明呈现:这里不"兜到某个已知档"而是走一条**独立且只读**的档 ——
 * 提现状态涉及资金,把未知值猜成 completed(已到账)或 pending(审核中)都是对用户谎报;
 * 独立档既不在任何可操作集合里,也不冒充已知档,就是票面要求的"不再产生副作用那一档"。
 * (需要把未知值折进某个已知档的决策/写侧站点用同源的 `coerceKnownOr`。)
 */
const UNKNOWN_STATUS_META = {
  label: t('aiAssistantN8n.statusUnknown'),
  color: 'text-muted-foreground',
}

/** 读侧判定:已知档取完备表,未知档取独立呈现(不冒充已知档、无可操作语义) */
function statusMetaOf(raw: unknown): { label: string; color: string } {
  const hit = narrowKnown(raw, WITHDRAWAL_DISPLAY_STATUSES)
  return hit ? STATUS_MAP[hit] : UNKNOWN_STATUS_META
}

export default function WithdrawalRecords({
  records = [],
  loading = false,
  onViewDetail,
  onReachBottom,
}: WithdrawalRecordsProps) {
  const tt = useTt()
  return (
    <View className="bg-card mx-3 my-3 rounded-lg overflow-hidden">
      <View className="flex items-center justify-between px-4 py-3 mb-2">
        <Text className="text-sm font-medium text-foreground">
          {tt('withdrawal.records', '提现记录')}
        </Text>
      </View>

      <ScrollView
        scrollY
        style={{ maxHeight: '50vh' }}
        onScrollToLower={onReachBottom}
        lowerThreshold={50}
      >
        {loading ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">
              {tt('common.loadingShort', '加载中...')}
            </Text>
          </View>
        ) : records.length === 0 ? (
          <EmptyState text={tt('tail.10', '暂无提现记录')} />
        ) : (
          records.map((record) => {
            // 值域判定与呈现只走 statusMetaOf 这一处,表本身是完备 Record(漏一档 = TS 错误)
            const status = statusMetaOf(record.status)
            return (
              <View
                key={record.id}
                className="flex items-center px-4 py-3 mb-[12rpx]"
                onClick={() => onViewDetail?.(record)}
                hoverClass="opacity-60"
              >
                <View className="flex-1">
                  <View className="flex items-center">
                    <Text className="text-sm font-medium text-foreground">
                      ¥{record.amount.toFixed(2)}
                    </Text>
                    <Text className={`ml-2 text-xs ${status.color}`}>{status.label}</Text>
                  </View>
                  <View className="flex items-center mt-[4rpx]">
                    {record.method && (
                      <Text className="text-xs text-muted-foreground mr-2">{record.method}</Text>
                    )}
                    {record.createdAt && (
                      <Text className="text-xs text-muted-foreground">{record.createdAt}</Text>
                    )}
                  </View>
                  {record.remark && (
                    <Text className="block text-xs text-muted-foreground mt-[4rpx] truncate">
                      {record.remark}
                    </Text>
                  )}
                </View>
                <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
