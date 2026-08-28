import { t } from '@/i18n'
import { View, Text } from '@tarojs/components'

export interface PageLoadingProps {
  text?: string
}

export default function PageLoading({ text = t('tail.8') }: PageLoadingProps) {
  return (
    <View className="flex flex-col items-center justify-center py-16">
      <View className="w-8 h-8 mb-3 rounded-full border-2 border-border border-t-indigo-500 animate-spin" />
      <Text className="text-sm text-muted-foreground">{text}</Text>
    </View>
  )
}
