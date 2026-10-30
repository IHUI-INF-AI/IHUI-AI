// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'
import { t, useTt } from '@/i18n'
import { formatPrice } from '@ihui/shared/utils/format'
import type { VipLevel } from '@/api'

interface VipLevelsProps {
  /** 后端 GET /vip/levels 的 items(公开端点,price 单位为分) */
  levels: VipLevel[]
  /** 拉取失败时的提示文案;空串 = 正常 */
  error: string
  onRetry: () => void
}

/**
 * 在架最低档 —— 母页「开通 VIP」CTA 的价格源(与本页同一支 GET /vip/levels,不另取端点)。
 * `/vip/levels` 已由 listVipLevels(true) 过滤 status=1,这里再核一次是防在册清单口径变动。
 * 取不到档位 ⇒ 返回 null,由调用方整块不渲染(拿 0 或写死常量冒充 = 可见错误文案)。
 */
export function pickEntryLevel(levels: VipLevel[]): VipLevel | null {
  return levels
    .filter((l) => l.status === 1)
    .reduce<VipLevel | null>((min, l) => (!min || l.price < min.price ? l : min), null)
}

/**
 * 时长最长的一档 —— 母页「升级永久 VIP」CTA 的价格源。
 * 库里没有「永久」标志位,可判定的最近语义是 durationDays 最大(种子 0037:永久会员 36500 天);
 * 划线原价后端无字段(vip_levels 无 original_price 列)⇒ 不伪造,母页不再展示原价。
 */
export function pickPermanentLevel(levels: VipLevel[]): VipLevel | null {
  return levels
    .filter((l) => l.status === 1)
    .reduce<VipLevel | null>(
      (max, l) => (!max || l.durationDays > max.durationDays ? l : max),
      null,
    )
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
                  ¥ {formatPrice(level.price)}
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
