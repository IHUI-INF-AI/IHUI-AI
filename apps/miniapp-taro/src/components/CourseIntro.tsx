// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'

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
  const tt = useTt()
  return (
    <View className="bg-card px-lg py-md">
      {data.description && (
        <View className="mb-lg">
          <Text className="block text-body font-medium text-foreground mb-sm">
            {tt('course.intro', '课程介绍')}
          </Text>
          <Text className="block text-label text-muted-foreground leading-relaxed">
            {data.description}
          </Text>
        </View>
      )}

      {data.objectives && data.objectives.length > 0 && (
        <View className="mb-lg">
          <Text className="block text-body font-medium text-foreground mb-sm">
            {tt('course.objectives', '学习目标')}
          </Text>
          {data.objectives.map((obj, i) => (
            <View key={i} className="flex items-start mb-[12rpx]">
              <LineIcon
                name="check"
                size="14px"
                color="var(--color-muted-foreground)"
                className="mr-sm"
              />
              <Text className="flex-1 text-label text-muted-foreground">{obj}</Text>
            </View>
          ))}
        </View>
      )}

      {data.highlights && data.highlights.length > 0 && (
        <View className="mb-lg">
          <Text className="block text-body font-medium text-foreground mb-sm">
            {tt('course.highlights', '课程亮点')}
          </Text>
          <View className="flex flex-wrap">
            {data.highlights.map((h, i) => (
              <Text
                key={i}
                className="text-caption px-sm py-xs mr-[12rpx] mb-xs rounded bg-primary/10 text-primary"
              >
                {h}
              </Text>
            ))}
          </View>
        </View>
      )}

      {data.suitableFor && data.suitableFor.length > 0 && (
        <View>
          <Text className="block text-body font-medium text-foreground mb-sm">
            {tt('course.audience', '适合人群')}
          </Text>
          {data.suitableFor.map((s, i) => (
            <View key={i} className="flex items-start mb-[12rpx]">
              <Text className="text-label text-primary mr-sm">·</Text>
              <Text className="flex-1 text-label text-muted-foreground">{s}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
