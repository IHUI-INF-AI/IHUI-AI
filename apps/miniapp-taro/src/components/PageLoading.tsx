import { View, Text } from '@tarojs/components'

export interface PageLoadingProps {
  text?: string
}

export default function PageLoading({ text = '加载中...' }: PageLoadingProps) {
  return (
    <View className="flex flex-col items-center justify-center py-16">
      <View className="w-8 h-8 mb-3 rounded-full border-2 border-gray-200 border-t-indigo-500 animate-spin" />
      <Text className="text-sm text-gray-400">{text}</Text>
    </View>
  )
}
