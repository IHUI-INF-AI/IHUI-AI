import { View, Text } from '@tarojs/components'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  inline?: boolean
}

export default function LoadingSpinner({
  size = 'md',
  text = '加载中',
  inline = false,
}: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <View className={`flex items-center justify-center ${inline ? 'inline-flex' : 'py-8'}`}>
      <View
        className={`${sizeClass} mr-2 rounded-full border-2 border-border border-t-indigo-500 animate-spin`}
      />
      <Text className={`${textClass} text-muted-foreground`}>{text}</Text>
    </View>
  )
}
