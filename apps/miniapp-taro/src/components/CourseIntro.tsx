import { View, Text } from '@tarojs/components'

export interface CourseIntroData {
  description?: string
  objectives?: string[]
  suitableFor?: string[]
  highlights?: string[]
}

export interface CourseIntroProps {
  data?: CourseIntroData
}

export default function CourseIntro({ data = {} }: CourseIntroProps) {
  return (
    <View className="bg-white px-4 py-3">
      {data.description && (
        <View className="mb-4">
          <Text className="block text-sm font-medium text-gray-800 mb-2">课程介绍</Text>
          <Text className="block text-xs text-gray-600 leading-relaxed">{data.description}</Text>
        </View>
      )}

      {data.objectives && data.objectives.length > 0 && (
        <View className="mb-4">
          <Text className="block text-sm font-medium text-gray-800 mb-2">学习目标</Text>
          {data.objectives.map((obj, i) => (
            <View key={i} className="flex items-start mb-1.5">
              <Text className="text-xs text-green-500 mr-2">✓</Text>
              <Text className="flex-1 text-xs text-gray-600">{obj}</Text>
            </View>
          ))}
        </View>
      )}

      {data.highlights && data.highlights.length > 0 && (
        <View className="mb-4">
          <Text className="block text-sm font-medium text-gray-800 mb-2">课程亮点</Text>
          <View className="flex flex-wrap">
            {data.highlights.map((h, i) => (
              <Text
                key={i}
                className="text-[11px] px-2 py-1 mr-1.5 mb-1 rounded bg-indigo-50 text-indigo-600"
              >
                {h}
              </Text>
            ))}
          </View>
        </View>
      )}

      {data.suitableFor && data.suitableFor.length > 0 && (
        <View>
          <Text className="block text-sm font-medium text-gray-800 mb-2">适合人群</Text>
          {data.suitableFor.map((s, i) => (
            <View key={i} className="flex items-start mb-1.5">
              <Text className="text-xs text-indigo-500 mr-2">·</Text>
              <Text className="flex-1 text-xs text-gray-600">{s}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
