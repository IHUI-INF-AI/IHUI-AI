import { View, Text } from '@tarojs/components'
import { useState } from 'react'

export interface CourseRatingProps {
  initialRating?: number
  initialComment?: string
  onSubmit?: (rating: number, comment: string) => void
  visible?: boolean
}

export default function CourseRating({
  initialRating = 0,
  initialComment = '',
  onSubmit,
  visible = false,
}: CourseRatingProps) {
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState(initialComment)
  const [hoverRating, setHoverRating] = useState(0)

  if (!visible) return null

  const labels = ['', '很差', '较差', '一般', '不错', '很好']

  return (
    <View
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => onSubmit?.(rating, comment)}
    >
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-white rounded-xl mx-8 px-6 py-5 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Text className="block text-base font-medium text-gray-800 mb-3 text-center">评价课程</Text>

        <View className="flex justify-center mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Text
              key={star}
              className={`text-3xl mx-1 ${
                (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-200'
              }`}
              onClick={() => setRating(star)}
              onTouchStart={() => setHoverRating(star)}
              onTouchEnd={() => setHoverRating(0)}
            >
              ★
            </Text>
          ))}
        </View>
        <Text className="block text-xs text-gray-500 text-center mb-4">
          {labels[hoverRating || rating] || '请评分'}
        </Text>

        <View className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
          <Text className="block text-xs text-gray-400 mb-1">写下你的评价</Text>
          <Input
            className="w-full text-sm"
            placeholder="课程怎么样?分享你的感受..."
            value={comment}
            onInput={(e) => setComment(e.detail.value)}
            maxlength={200}
          />
        </View>

        <View
          className="w-full py-2.5 rounded-full bg-indigo-500 text-center"
          onClick={() => onSubmit?.(rating, comment)}
        >
          <Text className="text-sm text-white">提交评价</Text>
        </View>
      </View>
    </View>
  )
}

import { Input } from '@tarojs/components'
