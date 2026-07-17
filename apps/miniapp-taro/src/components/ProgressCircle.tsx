import { View, Text } from '@tarojs/components'

export interface ProgressCircleProps {
  percent?: number
  size?: number
  strokeWidth?: number
  color?: string
  bgColor?: string
  showText?: boolean
  text?: string
}

export default function ProgressCircle({
  percent = 0,
  size = 60,
  strokeWidth = 4,
  color = '#6366f1',
  bgColor = '#e5e7eb',
  showText = true,
  text,
}: ProgressCircleProps) {
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <View
      className="relative flex items-center justify-center"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <View
        className="absolute inset-0 rounded-md"
        style={{
          borderWidth: `${strokeWidth}px`,
          borderStyle: 'solid',
          borderColor: bgColor,
        }}
      />
      <View
        className="absolute rounded-md"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderWidth: `${strokeWidth}px`,
          borderStyle: 'solid',
          borderColor: `${color} transparent transparent transparent`,
          transform: `rotate(${(clamped / 100) * 360 - 90}deg)`,
        }}
      />
      {showText && (
        <View className="absolute inset-0 flex items-center justify-center">
          <Text className="text-xs font-medium text-gray-700">
            {text || `${Math.floor(clamped)}%`}
          </Text>
        </View>
      )}
    </View>
  )
}
