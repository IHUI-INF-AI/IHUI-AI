// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text, Image, Video, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, getCurrentInstance } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getShareContentByCode } from '@/api'
import { showShareMenu } from '@/utils/share'
import { logger } from '@/utils/logger'
import { NavBar } from '@/components'
import ErrorView from '@/components/ErrorView'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

interface ShareAnswer {
  thinking?: string
  text?: string
  images?: string[]
  video?: { url: string; cover?: string; width?: number; height?: number }
  audio?: { url: string; duration?: number }
  lists?: Array<{ type: 'text' | 'image' | 'video' | 'audio'; content: string }>
}
interface ShareContent {
  code: string
  modelName: string
  modelIcon: string
  question: string
  answer: ShareAnswer
  tokenCost?: number
  createdAt: string
  userAvatar?: string | null
  userName?: string | null
  agentId?: string
  userUuid?: string
  gcType?: string
  content?: string
  status?: number
}

const fmtTime = (iso: string) => formatDateByTemplate(iso, 'YYYY-MM-DD HH:mm')

export default function ShareCreationPage() {
  const { t } = useI18n()
  const [content, setContent] = useState<ShareContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const code = useMemo(() => {
    const inst = getCurrentInstance()
    return (inst.router?.params?.code || '') as string
  }, [])

  const load = useCallback(async () => {
    if (!code) {
      setError(t('share.creation.missingCode'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = (await getShareContentByCode(code)) as ShareContent
      setContent(res)
    } catch (e) {
      logger.error('share/index', '获取分享内容', e)
      setError(e instanceof Error ? e.message : t('share.creation.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [code, t])

  useDidShow(() => {
    load()
    showShareMenu()
  })

  useShareAppMessage(() => ({
    title: content?.question || content?.modelName || t('share.creation.title'),
    path: `/pages/share/creation?code=${code}`,
    imageUrl: content?.answer?.images?.[0] || content?.modelIcon || '',
  }))

  const onRegenerate = useCallback(() => {
    if (content?.agentId) {
      Taro.navigateTo({ url: `/pages/ai/agent-detail?id=${content.agentId}` })
    } else {
      Taro.navigateTo({ url: '/pages/ai/chat' })
    }
  }, [content])

  const onShareFriend = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
    Taro.showToast({ title: t('share.creation.clickShare'), icon: 'none' })
  }, [t])

  if (loading) {
    return (
      <View className="min-h-screen bg-background">
        <NavBar title={t('share.creation.title')} showBack />
        <View className="flex items-center justify-center py-20">
          <Text className="text-sm text-muted-foreground">{t('share.creation.loading')}</Text>
        </View>
      </View>
    )
  }
  if (error || !content) {
    return (
      <View className="min-h-screen bg-background">
        <NavBar title={t('share.creation.title')} showBack />
        <ErrorView
          title={t('share.creation.loadFailed')}
          desc={error || t('share.creation.contentNotExist')}
          onRetry={load}
        />
      </View>
    )
  }

  const answer = content.answer || {}
  const images = answer.images || []
  const lists = answer.lists || []

  return (
    <ThemeRoot className="min-h-screen bg-background">
      <NavBar title={t('share.creation.title')} showBack />
      {/* 对齐 RN ChatScreen msgListContent(paddingHorizontal rpx(16) → 16rpx,paddingVertical rpx(24) → 24rpx) */}
      <ScrollView scrollY className="h-screen">
        {/* 会话信息头(小程序端业务展示,保留;卡片规格:底 --color-card、描边 --color-border、
            radius 12dp → 24rpx、padding 12dp → 24rpx,对齐 SquareScreen card 卡片语言) */}
        <View className="mx-[16rpx] mt-[16rpx] bg-card rounded-[24rpx] border-[2rpx] border-border p-[24rpx]">
          <View className="flex items-center mb-[24rpx]">
            {content.modelIcon ? (
              <Image
                className="w-[64rpx] h-[64rpx] rounded-[16rpx] mr-[16rpx]"
                src={content.modelIcon}
                mode="aspectFill"
              />
            ) : null}
            <View className="flex-1 min-w-0">
              <Text className="block text-[32rpx] font-semibold text-foreground truncate">
                {content.modelName || t('share.creation.modelDefault')}
              </Text>
              <Text className="block text-[24rpx] text-[var(--color-text-tertiary)]">
                {fmtTime(content.createdAt)}
              </Text>
            </View>
            {content.tokenCost ? (
              <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                {t('share.creation.tokenCost', { n: content.tokenCost })}
              </Text>
            ) : null}
          </View>
          {content.userName ? (
            <View className="flex items-center mb-[16rpx]">
              {content.userAvatar ? (
                <Image
                  className="w-[48rpx] h-[48rpx] rounded-[16rpx] mr-[16rpx]"
                  src={content.userAvatar}
                  mode="aspectFill"
                />
              ) : null}
              <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                {content.userName}
              </Text>
            </View>
          ) : null}
          {/* 提问 = 用户消息气泡:对齐 ChatScreen msgBubbleUser(bg brand,radius 16dp → 32rpx,
              padding rpx(28)/rpx(20),fontSize 15dp → 30rpx/lineHeight 40rpx) */}
          <View className="flex justify-end">
            <View className="max-w-[78%] bg-primary rounded-[32rpx] px-[28rpx] py-[20rpx]">
              <Text className="text-[30rpx] leading-[40rpx] text-[var(--color-primary-foreground)]">
                {content.question}
              </Text>
            </View>
          </View>
        </View>

        {/* AI 回答 = AI 内容卡片:对齐 RN 卡片规范(底 --color-card、描边 --color-border、
            radius 24rpx、padding 28/24rpx;底色对齐 ChatScreen msgBubbleAi surface.card) */}
        <View className="mx-[16rpx] mt-[20rpx] flex">
          <View className="flex-1 bg-card rounded-[24rpx] border-[2rpx] border-border px-[28rpx] py-[24rpx]">
            {/* 思考过程:对齐 ChatScreen thinkingBlock(bg surface.muted,radius 8dp → 16rpx) */}
            {answer.thinking ? (
              <View className="mb-[12rpx] rounded-[16rpx] bg-[var(--color-muted)] overflow-hidden">
                <View className="px-[20rpx] py-[16rpx]">
                  <Text className="text-[24rpx] font-semibold text-muted-foreground">
                    {t('share.creation.thinkingProcess')}
                  </Text>
                </View>
                {/* 对齐 thinkingContent(12dp → 24rpx,lineHeight 17 → 34rpx) */}
                <Text className="block px-[20rpx] pb-[20rpx] text-[24rpx] leading-[34rpx] text-muted-foreground whitespace-pre-wrap">
                  {answer.thinking}
                </Text>
              </View>
            ) : null}
            {/* 正文:对齐 msgTextAi(15dp → 30rpx,lineHeight 20 → 40rpx) */}
            {answer.text ? (
              <Text className="block text-[30rpx] leading-[40rpx] text-foreground whitespace-pre-wrap">
                {answer.text}
              </Text>
            ) : null}
            {/* 图片:对齐 msgImageWrap/msgImage(radius 8dp → 16rpx,180x140dp → 360x280rpx) */}
            {images.length ? (
              <View className="mt-[16rpx] flex flex-wrap gap-[16rpx]">
                {images.map((url, i) => (
                  <View
                    key={i}
                    className="rounded-[16rpx] overflow-hidden"
                    onClick={() => Taro.previewImage({ urls: images, current: url })}
                    hoverClass="opacity-60"
                  >
                    <Image
                      className="w-[360rpx] h-[280rpx] bg-[var(--color-muted)]"
                      src={url}
                      mode="aspectFill"
                    />
                  </View>
                ))}
              </View>
            ) : null}
            {answer.video?.url ? (
              <View className="mt-[16rpx] rounded-[16rpx] overflow-hidden">
                <Video
                  className="w-full"
                  style={{ height: '420rpx' }}
                  src={answer.video.url}
                  poster={answer.video.cover}
                  controls
                  objectFit="contain"
                />
              </View>
            ) : null}
            {answer.audio?.url ? (
              <View className="mt-[16rpx] px-[20rpx] py-[16rpx] bg-[var(--color-muted)] rounded-[16rpx] flex items-center">
                <Text className="text-[24rpx] text-foreground flex-1">
                  {t('share.creation.voiceAnswer')}
                </Text>
                <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                  {answer.audio.duration ? `${answer.audio.duration}s` : ''}
                </Text>
              </View>
            ) : null}
            {lists.length ? (
              <View className="mt-[16rpx] flex flex-col gap-[16rpx]">
                {lists.map((item, i) => (
                  <View key={i} className="py-[16rpx]">
                    {item.type === 'image' ? (
                      <Image
                        className="w-full rounded-[16rpx]"
                        src={item.content}
                        mode="widthFix"
                      />
                    ) : (
                      <Text className="block text-[30rpx] leading-[40rpx] text-foreground whitespace-pre-wrap">
                        {item.content}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View className="mx-[16rpx] mt-[24rpx] mb-[48rpx] flex gap-[16rpx]">
          <Button
            className="flex-1 text-[28rpx] rounded-[24rpx] !bg-primary !text-[var(--color-primary-foreground)]"
            onClick={onRegenerate}
          >
            {t('share.creation.regenerate')}
          </Button>
          <Button
            className="flex-1 text-[28rpx] rounded-[24rpx] !bg-muted !text-foreground"
            onClick={onShareFriend}
          >
            {t('share.creation.shareFriend')}
          </Button>
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
