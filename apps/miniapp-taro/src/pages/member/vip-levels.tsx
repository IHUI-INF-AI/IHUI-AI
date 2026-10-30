// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { t, useTt } from '@/i18n'
import type { VipLevel } from '@/api'

interface VipLevelsProps {
  /** 后端 GET /vip/levels 的 items(公开端点,price 单位为分) */
  levels: VipLevel[]
  /** 拉取失败时的提示文案;空串 = 正常 */
  error: string
  onRetry: () => void
}

/**
 * 会员等级区 —— 对齐共享屏 packages/app/src/features/vip/VipScreen.tsx 的 levelsSection:
 * 等级名 + 时长(vip.duration) + 权益项数(vip.benefitsCount) + 价格;
 * 列表为空走 vip.empty,拉取失败走 vip.retry 重试。
 * 标题取 vip.plans(套餐选择):页内「会员等级」已由成长梯度区承接,两区不重名。
 */
export default function VipLevels({ levels, error, onRetry }: VipLevelsProps) {
  const tt = useTt()

  return (
    <View className="mx-[20rpx] mb-[24rpx] p-[28rpx] bg-background border border-border rounded-lg">
      <Text className="block text-[length:40rpx] font-semibold text-foreground mb-[24rpx]">
        {tt('vip.plans', '套餐选择')}
      </Text>
      {error ? (
        <View className="flex items-center justify-between">
          <Text className="text-[length:24rpx] text-muted-foreground">{error}</Text>
          <Text className="text-[length:24rpx] text-[var(--color-brand)]" onClick={onRetry}>
            {tt('vip.retry', '重试')}
          </Text>
        </View>
      ) : levels.length === 0 ? (
        <Text className="block text-[length:24rpx] text-muted-foreground">
          {tt('vip.empty', '暂无会员等级信息')}
        </Text>
      ) : (
        levels.map((level) => {
          const benefitsCount = level.benefits ? Object.keys(level.benefits).length : 0
          return (
            <View key={level.id} className="mb-[16rpx] p-[20rpx] border border-border rounded-lg">
              <View className="flex items-center justify-between">
                <Text className="text-[length:28rpx] font-semibold text-foreground">
                  {level.levelName}
                </Text>
                <Text className="text-[length:24rpx] text-muted-foreground">
                  {t('vip.duration', { days: level.durationDays })}
                </Text>
              </View>
              <View className="flex items-end justify-between mt-[12rpx]">
                <Text className="text-[length:22rpx] text-muted-foreground">
                  {benefitsCount > 0 ? t('vip.benefitsCount', { count: benefitsCount }) : ''}
                </Text>
                <Text className="text-[length:36rpx] font-bold text-[var(--color-vip-gold-start)]">
                  ¥ {(level.price / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          )
        })
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
