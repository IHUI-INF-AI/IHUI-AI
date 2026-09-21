// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'

export interface LevelBadgeProps {
  level?: number
  title?: string
  progress?: number
  nextLevelTitle?: string
  size?: 'sm' | 'md' | 'lg'
}

// 段位配色对齐 RN 端:RN 共享层无段位彩色 badge,统一用中性 token
// (LightSurface.muted 底 + text.primary 字),浅/深主题自适应,清除遗留 purple/cyan/yellow 硬编码类。
const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-muted text-foreground',
  1: 'bg-muted text-foreground',
  2: 'bg-muted text-foreground',
  3: 'bg-muted text-foreground',
  4: 'bg-muted text-foreground',
  5: 'bg-muted text-foreground',
  6: 'bg-muted text-foreground',
}

export default function LevelBadge({
  level = 0,
  title,
  progress = 0,
  nextLevelTitle,
  size = 'md',
}: LevelBadgeProps) {
  const tt = useTt()
  const LEVEL_TITLES: Record<number, string> = {
    0: tt('level.0', '新手'),
    1: tt('level.1', '青铜'),
    2: tt('level.2', '白银'),
    3: tt('level.3', '黄金'),
    4: tt('level.4', '铂金'),
    5: tt('level.5', '钻石'),
    6: tt('level.6', '王者'),
  }
  const displayTitle = title || LEVEL_TITLES[level] || `L${level}`
  const colorClass = LEVEL_COLORS[level] || LEVEL_COLORS[0]
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-[20rpx]'
      : size === 'lg'
        ? 'px-3 py-1 text-sm'
        : 'px-2.5 py-0.5 text-xs'

  return (
    <View className="inline-flex items-center">
      <View className={`${sizeClass} ${colorClass} rounded-md font-medium`}>
        <Text>{displayTitle}</Text>
      </View>
      {nextLevelTitle && progress > 0 && progress < 100 && (
        <Text className="ml-2 text-[20rpx] text-muted-foreground">
          {tt('level.distance', '距')} {nextLevelTitle} {Math.floor(progress)}%
        </Text>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
