import { View, Text } from '@tarojs/components'

export interface EmptyStateProps {
  text?: string
  className?: string
}

export default function EmptyState({ text = '暂无数据', className = '' }: EmptyStateProps) {
  return (
    <View className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Text className="text-sm text-muted-foreground">{text}</Text>
    </View>
  )
}
