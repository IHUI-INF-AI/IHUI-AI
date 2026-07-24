import { logger } from '@/utils/logger'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { getAskDetail, type Ask } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[120rpx]">
      {data.title ? (
        <View className="bg-card p-[32rpx] mb-[24rpx]">
          <Text className="text-[36rpx] text-foreground font-bold leading-[1.4]">{data.title}</Text>
          <View className="flex items-center mt-[24rpx]">
            <Image
              className="w-[50rpx] h-[50rpx] rounded-[8rpx] bg-background"
              src={data.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <Text className="ml-[16rpx] text-[24rpx] text-muted-foreground">{data.author}</Text>
            <Text className="ml-auto text-[22rpx] text-muted-foreground">{data.createTime}</Text>
          </View>
          <View className="mt-[24rpx] text-[28rpx] text-foreground leading-[1.8]">{data.content}</View>
        </View>
      ) : null}

      {answers.length ? (
        <View className="bg-card p-[32rpx]">
          <View className="text-[28rpx] text-foreground font-semibold mb-[24rpx]">
            {t('ask.detail.answerCount', { n: answers.length })}
          </View>
          {answers.map((a, i) => (
            <View key={i} className={`py-[24rpx]${i > 0 ? ' mt-[16rpx]' : ''}`}>
              <View className="flex items-center">
                <Image
                  className="w-[50rpx] h-[50rpx] rounded-[8rpx] bg-background"
                  src={a.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
                <Text className="ml-[16rpx] text-[24rpx] text-muted-foreground">{a.author}</Text>
                <Text className="ml-auto text-[22rpx] text-muted-foreground">{a.time}</Text>
              </View>
              <View className="mt-[16rpx] text-[28rpx] text-foreground leading-[1.6]">{a.content}</View>
            </View>
          ))}
        </View>
      ) : null}

      <View className="fixed bottom-0 left-0 right-0 flex items-center py-[16rpx] px-[24rpx] bg-card">
        <Input
          className="flex-1 h-[72rpx] px-[24rpx] bg-background rounded-[36rpx] text-[26rpx]"
          value={answer}
          placeholder={t('ask.detail.placeholder')}
          onInput={(e) => setAnswer(e.detail.value)}
        />
        <Button className="ml-[16rpx] bg-primary disabled:bg-[#ccc] text-foreground text-[24rpx]" size="mini" onClick={onAnswer} disabled={!answer}>
          {t('ask.detail.answer')}
        </Button>
      </View>
    </View>
  )
}
