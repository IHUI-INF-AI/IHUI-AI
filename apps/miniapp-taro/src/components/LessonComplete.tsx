import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative bg-card rounded-xl mx-8 px-6 py-6 max-w-xs w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Text className="block text-4xl mb-3">🎉</Text>
        <Text className="block text-base font-medium text-foreground mb-1">{tt('lesson.complete', '学习完成!')}</Text>
        <Text className="block text-xs text-muted-foreground mb-4">{lessonTitle}</Text>

        <View className="flex justify-around mb-4 py-3 bg-muted rounded-lg">
          <View>
            <Text className="block text-sm font-medium text-foreground">{duration || '00:00'}</Text>
            <Text className="block text-xs text-muted-foreground">{tt('lesson.studyDuration', '学习时长')}</Text>
          </View>
          <View>
            <Text className="block text-sm font-medium text-[#f59e0b]">+{points}</Text>
            <Text className="block text-xs text-muted-foreground">{tt('lesson.points', '积分')}</Text>
          </View>
        </View>

        {nextLessonTitle && (
          <Text className="block text-xs text-muted-foreground mb-4">{t('lesson.next', { title: nextLessonTitle })}</Text>
        )}

        <View className="flex space-x-3">
          <View className="flex-1 py-2.5 rounded-md bg-muted" onClick={onShare}>
            <Text className="text-sm text-foreground">{tt('lesson.share', '分享')}</Text>
          </View>
          <View className="flex-1 py-2.5 rounded-md bg-primary" onClick={onContinue}>
            <Text className="text-sm text-white">{nextLessonTitle ? tt('lesson.continue', '继续学习') : tt('lesson.done', '完成')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
