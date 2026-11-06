// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 部分收敛保留段:未开发者引导卡(RN 共享屏无对应实现,留页内;与 header CTA 语义重复,
// 按用户裁决"重复段,建议后续由 RN 决定是否补",本批不迁、不新造 RN 功能)。
import { View, Text } from '@tarojs/components'

export interface DevGuideCardProps {
  title: string
  description: string
  ctaLabel: string
  onPress: () => void
}

export default function DevGuideCard({ title, description, ctaLabel, onPress }: DevGuideCardProps) {
  return (
    <View className="mx-[40rpx] mt-[40rpx] bg-card border-[length:2rpx] border-border rounded-lg p-[28rpx] flex flex-col gap-[12rpx]">
      <Text className="block text-title font-semibold text-foreground">{title}</Text>
      <Text className="block text-body leading-[38rpx] text-[var(--color-text-tertiary)]">
        {description}
      </Text>
      <View
        className="flex items-center justify-center py-[30rpx] bg-[var(--color-brand)] rounded-xl"
        onClick={onPress}
        hoverClass="opacity-60"
      >
        <Text className="text-title font-semibold text-primary-foreground">{ctaLabel}</Text>
      </View>
    </View>
  )
}
