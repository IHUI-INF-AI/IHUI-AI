// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { formatPrice } from '@/utils/time'

/** 卡片状态序与共享屏 statusOf 一致:取消结算优先于已结算/待结算 */
export type IncomeStatus = 'pending' | 'settled' | 'cancelled'

/** 一张收益卡的数据(佣金流水行与提现「已结算」行同构) */
export interface IncomeRow {
  id: string
  title: string
  buyer: string
  amount: number
  time: string
  orderId: string
  status: IncomeStatus
}

/**
 * 收益明细卡片(对齐共享屏 IncomeScreen 的 card:标题 + 状态 + 下单人 + 时间金额 + 关联订单/复制)。
 * 拆成同目录子模块只为守住单页 250 行;文案键与共享屏同源,不另造键。
 */
export function IncomeItem({ row }: { row: IncomeRow }) {
  const { t } = useI18n()
  const STATUS_TEXT: Record<IncomeStatus, string> = {
    pending: t('income.pending'),
    settled: t('income.settled'),
    cancelled: t('income.cancelled'),
  }
  const STATUS_CLASS: Record<IncomeStatus, string> = {
    pending: 'text-warning',
    settled: 'text-success',
    cancelled: 'text-muted-foreground',
  }

  const copyOrder = () => {
    void Taro.setClipboardData({ data: row.orderId }).then(() => {
      Taro.showToast({ title: t('income.copySuccess'), icon: 'none' })
    })
  }

  return (
    <View className="wc-item">
      <View className="wc-item-info">
        <View className="flex items-center justify-between">
          <Text className="wc-item-type flex-1 truncate">{row.title}</Text>
          <Text className={`text-[length:22rpx] font-semibold ${STATUS_CLASS[row.status]}`}>
            {STATUS_TEXT[row.status]}
          </Text>
        </View>
        {row.buyer ? (
          <Text className="wc-item-time truncate">{t('income.buyer', { name: row.buyer })}</Text>
        ) : null}
        <View className="flex items-center justify-between mt-[8rpx]">
          <Text className="wc-item-time">{row.time}</Text>
          <Text className={`wc-item-amount ${row.amount > 0 ? 'positive' : 'negative'}`}>
            {row.amount > 0 ? '+' : ''}¥{formatPrice(row.amount)}
          </Text>
        </View>
        <View className="flex items-center justify-between mt-[8rpx]">
          <Text className="wc-item-time flex-1 truncate">
            {t('income.relatedOrder', { orderNo: row.orderId || '—' })}
          </Text>
          {row.orderId ? (
            <View
              className="ml-[16rpx] px-[16rpx] py-[6rpx] rounded-sm border border-border"
              onClick={copyOrder}
            >
              <Text className="text-[length:22rpx] text-primary">{t('income.copy')}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
