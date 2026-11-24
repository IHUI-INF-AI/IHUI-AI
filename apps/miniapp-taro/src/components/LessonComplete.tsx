// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'

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
  const tt = useTt()
  if (!visible) return null

  return (
    <View className="fixed inset-0 z-[2000] flex items-center justify-center" onClick={onClose}>
      <View className="absolute inset-0 bg-[var(--color-black-50)]" />
      <View
        className="relative bg-card ui-panel rounded-xl mx-3xl px-2xl py-2xl max-w-xs w-full text-center"
        hoverClass="opacity-60"
        onClick={(e) => e.stopPropagation()}
      >
        <LineIcon
          name="party-popper"
          size={72}
          color="var(--color-muted-foreground)"
          className="block mb-md mx-auto"
        />
        <Text className="block text-title font-medium text-foreground mb-xs">
          {tt('lesson.complete', '学习完成!')}
        </Text>
        <Text className="block text-label text-muted-foreground mb-lg">{lessonTitle}</Text>

        <View className="flex justify-around mb-lg py-md bg-muted rounded-lg">
          <View>
            <Text className="block text-body font-medium text-foreground">{duration || '00:00'}</Text>
            <Text className="block text-label text-muted-foreground">
              {tt('lesson.studyDuration', '学习时长')}
            </Text>
          </View>
          <View>
            <Text className="block text-body font-medium text-warning">+{points}</Text>
            <Text className="block text-label text-muted-foreground">
              {tt('lesson.points', '积分')}
            </Text>
          </View>
        </View>

        {nextLessonTitle && (
          <Text className="block text-label text-muted-foreground mb-lg">
            {t('lesson.next', { title: nextLessonTitle })}
          </Text>
        )}

        <View className="flex space-x-md">
          <View
            className="flex-1 py-[20rpx] rounded-md bg-muted"
            hoverClass="opacity-60"
            onClick={onShare}
          >
            <Text className="text-body text-foreground">{tt('lesson.share', '分享')}</Text>
          </View>
          <View
            className="flex-1 py-[20rpx] rounded-md bg-primary"
            onClick={onContinue}
            hoverClass="opacity-60"
          >
            <Text className="text-body text-primary-foreground">
              {nextLessonTitle ? tt('lesson.continue', '继续学习') : tt('lesson.done', '完成')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
