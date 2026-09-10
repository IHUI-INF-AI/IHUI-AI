// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getAskDetail, type Ask } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface AnswerItem {
  author: string
  avatar?: string
  time: string
  content: string
}

export default function AskDetailPage() {
  const { t } = useI18n()
  const [data, setData] = useState<Ask>({} as Ask)
  const [answers, setAnswers] = useState<AnswerItem[]>([])
  const [answer, setAnswer] = useState('')
  const [id, setId] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      setData(await getAskDetail(id))
    } catch (e) {
      logger.error('ask/detail', '获取问题详情', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [id, t])

  useDidShow(() => {
    const instance = Taro.getCurrentInstance()
    const q = instance?.router?.params
    if (q?.id) {
      setId(q.id)
      load()
    }
  })

  useEffect(() => {
    if (id) load()
  }, [id, load])

  const onAnswer = useCallback(() => {
    if (!answer) return
    setAnswers((prev) => [
      ...prev,
      { author: t('ask.detail.me'), time: t('ask.detail.justNow'), content: answer },
    ])
    setAnswer('')
    Taro.showToast({ title: t('ask.detail.answered'), icon: 'success' })
  }, [answer, t])

  return (
    /* 对齐 RN 端 packages/app/src/features/ask-detail/AskDetailScreen.tsx(共享屏):
       扁平布局(标题/正文直接铺在 surface.bg 上,无白卡分段);
       标题 22dp→44rpx 600 / author 14dp→28rpx 500 secondary / meta 11dp→22rpx tertiary /
       正文 16dp→32rpx lineHeight 22dp→44rpx text.medium / 回答区标题 18dp→36rpx 600 /
       回答卡: padding 14dp→28rpx 圆角 12dp→24rpx 描边 border.light bg card
       (RN surface.light 恒白在暗色下不可读,按语义 token 改 --color-card)/
       回答正文 14dp→28rpx text.medium / 时间 22rpx tertiary /
       底部输入条按 RN input 语言: bg surface.muted 描边 border.light 圆角 24rpx。 */
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[20rpx] pt-[24rpx] pb-[180rpx]">
        {data.title ? (
          <View>
            <Text className="block text-[44rpx] text-foreground font-semibold leading-[1.4]">
              {data.title}
            </Text>
            <View className="flex items-center justify-between mt-[12rpx] mb-[24rpx]">
              <View className="flex items-center">
                <Image
                  className="w-[50rpx] h-[50rpx] rounded-[8rpx] bg-muted"
                  src={data.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <Text className="ml-[16rpx] text-[28rpx] text-muted-foreground font-medium">
                  {data.author}
                </Text>
              </View>
              <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                {data.createTime}
              </Text>
            </View>
            <View className="text-[32rpx] text-[var(--color-text-medium)] leading-[44rpx]">
              {data.content}
            </View>
          </View>
        ) : null}

        {answers.length ? (
          <View className="mt-[32rpx]">
            <View className="text-[36rpx] text-foreground font-semibold mb-[16rpx]">
              {t('ask.detail.answerCount', { n: answers.length })}
            </View>
            {answers.map((a, i) => (
              <View
                key={i}
                className="bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx] mb-[24rpx]"
              >
                <View className="flex items-center">
                  <Image
                    className="w-[50rpx] h-[50rpx] rounded-[8rpx] bg-muted"
                    src={a.avatar || '/static/default-avatar.png'}
                    mode="aspectFill"
                  />
                  <Text className="ml-[16rpx] text-[28rpx] text-muted-foreground font-medium">
                    {a.author}
                  </Text>
                  <Text className="ml-auto text-[22rpx] text-[var(--color-text-tertiary)]">
                    {a.time}
                  </Text>
                </View>
                <View className="mt-[12rpx] text-[28rpx] text-[var(--color-text-medium)] leading-[1.6]">
                  {a.content}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View
          className="fixed bottom-0 left-0 right-0 flex items-center py-[16rpx] px-[20rpx] bg-card"
          style={{ paddingBottom: 'calc(16rpx + env(safe-area-inset-bottom))' }}
        >
          <Input
            className="flex-1 h-[72rpx] px-[24rpx] bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
            value={answer}
            placeholder={t('ask.detail.placeholder')}
            onInput={(e) => setAnswer(e.detail.value)}
          />
          <Button
            className={`ml-[16rpx] rounded-[24rpx] text-[24rpx] ${answer ? 'bg-[var(--color-brand)] text-primary-foreground' : 'bg-[var(--color-text-tertiary)] text-card'}`}
            size="mini"
            onClick={onAnswer}
            disabled={!answer}
          >
            {t('ask.detail.answer')}
          </Button>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
