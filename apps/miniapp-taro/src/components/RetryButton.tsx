import { View, Text } from '@tarojs/components'

export interface RetryButtonProps {
  text?: string
  onClick?: () => void
}

export default function RetryButton({ text = '重试', onClick }: RetryButtonProps) {
  return (
    <View className="inline-flex items-center px-4 py-2 rounded-md bg-primary/10" onClick={onClick}>
      <Text className="text-sm text-primary">↻ {text}</Text>
    </View>
  )
}
