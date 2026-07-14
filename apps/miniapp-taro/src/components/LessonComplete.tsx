import { View, Text } from '@tarojs/components'

export interface LessonCompleteProps {
  visible?: boolean
  lessonTitle?: string
  duration?: string
  points?: number
  nextLessonTitle?: string
  onContinue?: () => void
  onShare?: () => void
  onClose?: () => void
}

export default function LessonComplete({
  visible = false,
  lessonTitle = '',
  duration = '',
  points = 10,
  nextLessonTitle,
  onContinue,
  onShare,
  onClose,
}: LessonCompleteProps) {
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-white rounded-xl mx-8 px-6 py-6 max-w-xs w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Text className="block text-4xl mb-3">🎉</Text>
        <Text className="block text-base font-medium text-gray-800 mb-1">学习完成!</Text>
        <Text className="block text-xs text-gray-400 mb-4">{lessonTitle}</Text>

        <View className="flex justify-around mb-4 py-3 bg-gray-50 rounded-lg">
          <View>
            <Text className="block text-sm font-medium text-gray-700">{duration || '00:00'}</Text>
            <Text className="block text-xs text-gray-400">学习时长</Text>
          </View>
          <View>
            <Text className="block text-sm font-medium text-orange-500">+{points}</Text>
            <Text className="block text-xs text-gray-400">积分</Text>
          </View>
        </View>

        {nextLessonTitle && (
          <Text className="block text-xs text-gray-500 mb-4">下一节: {nextLessonTitle}</Text>
        )}

        <View className="flex space-x-3">
          <View className="flex-1 py-2.5 rounded-full bg-gray-100" onClick={onShare}>
            <Text className="text-sm text-gray-600">分享</Text>
          </View>
          <View className="flex-1 py-2.5 rounded-full bg-indigo-500" onClick={onContinue}>
            <Text className="text-sm text-white">{nextLessonTitle ? '继续学习' : '完成'}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
