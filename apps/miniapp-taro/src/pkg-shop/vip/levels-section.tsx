// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会员等级目录(从 index.tsx 拆出:页面已超 250 行,新增块按规矩落同目录子模块)
import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import { formatPrice } from '@ihui/shared/utils/format'
import type { VipLevel } from '@/api'

/**
 * 对齐共享屏 packages/app/src/features/vip/VipScreen.tsx 的 levelsSection:
 * 等级名 + 当前等级徽章 + 时长 + 价格 + 权益数 + 开通按钮;levels 为空时给空态。
 * 数据 = GET /api/vip/levels 的 items(price 单位为分,展示时折成元)。
 */
export interface LevelsSectionProps {
  levels: VipLevel[]
  currentLevel: number
  /** 首屏还没拿到等级时不冒充「暂无等级」(空态只属于「取到了但确实没有」) */
  loaded: boolean
  onPurchase: (levelId: string) => void
}

export default function LevelsSection({
  levels,
  currentLevel,
  loaded,
  onPurchase,
}: LevelsSectionProps) {
  const { t } = useI18n()
  return (
    <View className="px-[40rpx] pb-[40rpx]">
      <Text className="block text-[length:32rpx] font-bold text-foreground mb-[32rpx]">
        {t('vip.levelsTitle')}
      </Text>
      {!loaded ? null : levels.length === 0 ? (
        <Text className="block py-[48rpx] text-center text-[length:26rpx] text-muted-foreground">
          {t('vip.empty')}
        </Text>
      ) : (
        <View className="flex flex-col gap-[24rpx]">
          {levels.map((level) => {
            const isCurrent = currentLevel === level.levelValue
            const canPurchase = !isCurrent && level.status === 1
            const benefitsCount = level.benefits ? Object.keys(level.benefits).length : 0
            return (
              <View
                key={level.id}
                className="bg-card border-[length:2rpx] border-border rounded-lg p-[24rpx]"
              >
                <View className="flex items-center justify-between gap-[16rpx]">
                  <Text className="text-[length:32rpx] font-semibold text-foreground">
                    {level.levelName}
                  </Text>
                  {isCurrent ? (
                    <Text className="px-[16rpx] py-[4rpx] rounded-md bg-[var(--color-vip-gold-start)] text-[length:20rpx] font-semibold text-[var(--color-vip-card)]">
                      {t('vip.currentBadge')}
                    </Text>
                  ) : null}
                </View>
                <View className="flex items-end justify-between mt-[16rpx]">
                  <Text className="text-[length:24rpx] text-muted-foreground">
                    {t('vip.duration', { days: level.durationDays })}
                  </Text>
                  <Text className="text-[length:32rpx] font-bold text-[var(--color-vip-gold-start)]">
                    ¥ {formatPrice(level.price)}
                  </Text>
                </View>
                {benefitsCount > 0 ? (
                  <Text className="block mt-[16rpx] text-[length:24rpx] text-muted-foreground">
                    {t('vip.benefitsCount', { count: benefitsCount })}
                  </Text>
                ) : null}
                {canPurchase ? (
                  <View
                    className="mt-[24rpx] py-[16rpx] rounded-md bg-[var(--color-vip-gold-start)] flex items-center justify-center"
                    hoverClass="opacity-60"
                    onClick={() => onPurchase(level.id)}
                  >
                    <Text className="text-[length:28rpx] font-bold text-[var(--color-vip-card)]">
                      {t('vip.purchase')}
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
