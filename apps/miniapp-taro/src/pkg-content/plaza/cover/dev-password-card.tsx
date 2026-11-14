// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 部分收敛保留段:开发者密码行(RN 数据模型无 password,无法两端显式传值 ⇒ 按用户裁决不迁、
// 不用"可选 prop+缺省"掩盖单端;留页内本地组件,其余行走共享信息卡)。
import { View, Text } from '@tarojs/components'

export interface DevPasswordCardProps {
  title: string
  label: string
  value: string
  copyLabel: string
  onCopy: () => void
}

export default function DevPasswordCard({
  title,
  label,
  value,
  copyLabel,
  onCopy,
}: DevPasswordCardProps) {
  return (
    <View className="mx-[40rpx] mt-[40rpx] bg-card border-[length:2rpx] border-border rounded-lg p-[28rpx]">
      <Text className="block text-title font-semibold text-foreground mb-[24rpx]">{title}</Text>
      <View className="flex items-center">
        <Text className="w-[152rpx] shrink-0 text-body text-muted-foreground">{label}</Text>
        <Text className="flex-1 min-w-0 text-body text-foreground overflow-hidden ihui-ellipsis whitespace-nowrap">
          {value || '-'}
        </Text>
        <Text className="pl-[16rpx] shrink-0 text-body text-[var(--color-brand)]" onClick={onCopy}>
          {copyLabel}
        </Text>
      </View>
    </View>
  )
}
