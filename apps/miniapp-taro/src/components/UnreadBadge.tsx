import { View, Text } from '@tarojs/components'

export interface UnreadBadgeProps {
  count: number
  max?: number
  size?: 'sm' | 'md'
  showZero?: boolean
}

export default function UnreadBadge({
  count,
  max = 99,
  size = 'sm',
  showZero = false,
}: UnreadBadgeProps) {
  if (count <= 0) {
    if (!showZero) return null
    return (
      <View
        className={`flex items-center justify-center bg-muted rounded-md ${
          size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
        }`}
      >
        <Text className="text-[10px] text-white">0</Text>
      </View>
    )
  }

  const display = count > max ? `${max}+` : `${count}`
  const isDot = count > 0 && count < 1
  if (isDot) {
    return <View className="w-2 h-2 rounded-full bg-destructive" />
  }

  const minWidth = display.length > 1 ? `${16 + (display.length - 1) * 6}px` : '16px'

  return (
    <View
      className="flex items-center justify-center bg-destructive rounded-md px-1"
      style={{ minWidth, height: size === 'sm' ? 16 : 20 }}
    >
      <Text className={`text-white ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>{display}</Text>
    </View>
  )
}
