import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

export interface LevelBadgeProps {
  level?: number
  title?: string
  progress?: number
  nextLevelTitle?: string
  size?: 'sm' | 'md' | 'lg'
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-muted text-foreground',
  1: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  2: 'bg-muted text-foreground',
  3: 'bg-yellow-50 text-[#f59e0b]',
  4: 'bg-primary/10 text-primary',
  5: 'bg-cyan-50 text-cyan-600',
  6: 'bg-purple-50 text-purple-600',
}

export default function LevelBadge({
  level = 0,
  title,
  progress = 0,
  nextLevelTitle,
  size = 'md',
}: LevelBadgeProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
        ? 'px-3 py-1 text-sm'
        : 'px-2.5 py-0.5 text-xs'

  return (
    <View className="inline-flex items-center">
      <View className={`${sizeClass} ${colorClass} rounded-md font-medium`}>
        <Text>{displayTitle}</Text>
      </View>
      {nextLevelTitle && progress > 0 && progress < 100 && (
        <Text className="ml-2 text-[10px] text-muted-foreground">
          {tt('level.distance', '距')} {nextLevelTitle} {Math.floor(progress)}%
        </Text>
      )}
    </View>
  )
}
