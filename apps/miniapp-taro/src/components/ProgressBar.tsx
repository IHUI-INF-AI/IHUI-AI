import { View, Text } from '@tarojs/components'

export interface ProgressBarProps {
  percent?: number
  showText?: boolean
  color?: string
  height?: number
}

export default function ProgressBar({
  percent = 0,
  showText = false,
  color = '#6366f1',
  height = 4,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <View className="w-full">
      <View
        className="w-full bg-muted rounded-md overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <View
          className="rounded-md transition-all"
          style={{ width: `${clamped}%`, height: '100%', backgroundColor: color }}
        />
      </View>
      {showText && (
        <Text className="block text-xs text-muted-foreground mt-1 text-right">{Math.floor(clamped)}%</Text>
      )}
    </View>
  )
}
