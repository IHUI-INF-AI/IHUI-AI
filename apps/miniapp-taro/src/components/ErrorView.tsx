import { View, Text } from '@tarojs/components'

export interface ErrorViewProps {
  title?: string
  desc?: string
  onRetry?: () => void
}

export default function ErrorView({
  title = '加载失败',
  desc = '请稍后重试',
  onRetry,
}: ErrorViewProps) {
  return (
    <View className="flex flex-col items-center justify-center py-12 px-4">
      <Text className="text-4xl text-gray-300 mb-3">⚠</Text>
      <Text className="text-sm font-medium text-gray-700 mb-1">{title}</Text>
      <Text className="text-xs text-gray-400 mb-4 text-center">{desc}</Text>
      {onRetry && (
        <View className="px-4 py-2 rounded-full bg-indigo-50" onClick={onRetry}>
          <Text className="text-sm text-indigo-600">重试</Text>
        </View>
      )}
    </View>
  )
}
