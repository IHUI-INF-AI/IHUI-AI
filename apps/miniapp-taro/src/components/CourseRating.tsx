import { View, Text, Input } from '@tarojs/components'
import { useState } from 'react'
import { useI18n } from '@/i18n'

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

  const { t, tList } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  if (!visible) return null

  const ratingLabels = tList('course.ratingLabels')
  const labels = ratingLabels.length > 0 ? ratingLabels : ['', tt('course.rating1', '很差'), tt('course.rating2', '较差'), tt('course.rating3', '一般'), tt('course.rating4', '不错'), tt('course.rating5', '很好')]

  return (
    <View
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => onSubmit?.(rating, comment)}
    >
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-card rounded-xl mx-8 px-6 py-5 max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <Text className="block text-base font-medium text-foreground mb-3 text-center">{tt('course.ratingTitle', '评价课程')}</Text>

        <View className="flex justify-center mb-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Text
              key={star}
              className={`text-3xl mx-1 ${
                (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-muted-foreground'
              }`}
              onClick={() => setRating(star)}
              onTouchStart={() => setHoverRating(star)}
              onTouchEnd={() => setHoverRating(0)}
            >
              ★
            </Text>
          ))}
        </View>
        <Text className="block text-xs text-muted-foreground text-center mb-4">
          {labels[hoverRating || rating] || tt('course.ratingPlaceholder', '请评分')}
        </Text>

        <View className="bg-muted rounded-lg px-3 py-2 mb-4">
          <Text className="block text-xs text-muted-foreground mb-1">{tt('course.ratingDescLabel', '写下你的评价')}</Text>
          <Input
            className="w-full text-sm"
            placeholder={tt('course.ratingInputPlaceholder', '课程怎么样?分享你的感受...')}
            value={comment}
            onInput={(e) => setComment(e.detail.value)}
            maxlength={200}
          />
        </View>

        <View
          className="w-full py-2.5 rounded-md bg-primary text-center"
          onClick={() => onSubmit?.(rating, comment)}
        >
          <Text className="text-sm text-white">{tt('course.ratingSubmit', '提交评价')}</Text>
        </View>
      </View>
    </View>
  )
}
