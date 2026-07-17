import { View, Text } from '@tarojs/components'

export interface LevelBadgeProps {
  level?: number
  title?: string
  progress?: number
  nextLevelTitle?: string
  size?: 'sm' | 'md' | 'lg'
}

const LEVEL_TITLES: Record<number, string> = {
  0: '新手',
  1: '青铜',
  2: '白银',
  3: '黄金',
  4: '铂金',
  5: '钻石',
  6: '王者',
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'bg-gray-100 text-gray-600',
  1: 'bg-orange-50 text-orange-600',
  2: 'bg-gray-100 text-gray-700',
  3: 'bg-yellow-50 text-yellow-600',
  4: 'bg-indigo-50 text-indigo-600',
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
        <Text className="ml-2 text-[10px] text-gray-400">
          距 {nextLevelTitle} {Math.floor(progress)}%
        </Text>
      )}
    </View>
  )
}
