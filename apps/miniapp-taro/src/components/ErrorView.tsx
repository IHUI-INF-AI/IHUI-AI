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
      <Text className="text-4xl text-muted-foreground mb-3">⚠</Text>
      <Text className="text-sm font-medium text-foreground mb-1">{title}</Text>
      <Text className="text-xs text-muted-foreground mb-4 text-center">{desc}</Text>
      {onRetry && (
        <View className="px-4 py-2 rounded-md bg-primary/10" onClick={onRetry}>
          <Text className="text-sm text-primary">重试</Text>
        </View>
      )}
    </View>
  )
}
