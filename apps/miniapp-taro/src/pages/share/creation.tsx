import { View, Text, Image, Video, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, getCurrentInstance } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getShareContentByCode } from '@/api'
import { showShareMenu } from '@/utils/share'
import { logger } from '@/utils/logger'
import { NavBar } from '@/components'
import ErrorView from '@/components/ErrorView'

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

const fmtTime = (iso: string) => {
  try {
    const ts = new Date(iso).getTime()
    if (!ts) return ''
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(ts)
  } catch {
    return iso
  }
}

export default function ShareCreationPage() {
  const [content, setContent] = useState<ShareContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const code = useMemo(() => {
    const inst = getCurrentInstance()
    return (inst.router?.params?.code || '') as string
  }, [])

  const load = useCallback(async () => {
    if (!code) {
      setError('缺少分享码')
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
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [code])

  useDidShow(() => {
    load()
    showShareMenu()
  })

  useShareAppMessage(() => ({
    title: content?.question || content?.modelName || 'AI 创作分享',
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
    Taro.showToast({ title: '点击右上角分享给好友', icon: 'none' })
  }, [])

  if (loading) {
    return (
      <View className="min-h-screen bg-[#f7f8fa]">
        <NavBar title="AI 创作分享" showBack />
        <View className="flex items-center justify-center py-20">
          <Text className="text-sm text-gray-400">加载中...</Text>
        </View>
      </View>
    )
  }
  if (error || !content) {
    return (
      <View className="min-h-screen bg-[#f7f8fa]">
        <NavBar title="AI 创作分享" showBack />
        <ErrorView title="加载失败" desc={error || '分享内容不存在'} onRetry={load} />
      </View>
    )
  }

  const answer = content.answer || {}
  const images = answer.images || []
  const lists = answer.lists || []

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <NavBar title="AI 创作分享" showBack />
      <ScrollView scrollY className="h-screen">
        <View className="mx-3 mt-3 bg-white rounded-lg p-4">
          <View className="flex items-center mb-3">
            {content.modelIcon ? (
              <Image
                className="w-8 h-8 rounded-md mr-2"
                src={content.modelIcon}
                mode="aspectFill"
              />
            ) : null}
            <View className="flex-1 min-w-0">
              <Text className="block text-sm font-medium text-gray-800 truncate">
                {content.modelName || 'AI 模型'}
              </Text>
              <Text className="block text-xs text-gray-400">{fmtTime(content.createdAt)}</Text>
            </View>
            {content.tokenCost ? (
              <Text className="text-xs text-gray-400">消耗 {content.tokenCost} 智汇值</Text>
            ) : null}
          </View>
          {content.userName ? (
            <View className="flex items-center mb-2">
              {content.userAvatar ? (
                <Image
                  className="w-6 h-6 rounded-md mr-2"
                  src={content.userAvatar}
                  mode="aspectFill"
                />
              ) : null}
              <Text className="text-xs text-gray-500">{content.userName}</Text>
            </View>
          ) : null}
          <View className="px-3 py-2 bg-gray-50 rounded-md">
            <Text className="block text-sm text-gray-700">{content.question}</Text>
          </View>
        </View>

        {answer.thinking ? (
          <View className="mx-3 mt-2 bg-white rounded-lg p-4">
            <Text className="block text-xs text-gray-500 mb-2">思考过程</Text>
            <Text className="block text-xs text-gray-600 whitespace-pre-wrap">
              {answer.thinking}
            </Text>
          </View>
        ) : null}

        <View className="mx-3 mt-2 bg-white rounded-lg p-4">
          <Text className="block text-xs text-gray-500 mb-2">AI 回答</Text>
          {answer.text ? (
            <Text className="block text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {answer.text}
            </Text>
          ) : null}
          {images.length ? (
            <View className="grid grid-cols-2 gap-2 mt-3">
              {images.map((url, i) => (
                <Image
                  key={i}
                  className="w-full rounded-md"
                  src={url}
                  mode="widthFix"
                  onClick={() => Taro.previewImage({ urls: images, current: url })}
                />
              ))}
            </View>
          ) : null}
          {answer.video?.url ? (
            <View className="mt-3">
              <Video
                className="w-full rounded-md"
                style={{ height: '210px' }}
                src={answer.video.url}
                poster={answer.video.cover}
                controls
                objectFit="contain"
              />
            </View>
          ) : null}
          {answer.audio?.url ? (
            <View className="mt-3 p-2 bg-gray-50 rounded-md flex items-center">
              <Text className="text-xs text-gray-600 flex-1">🔊 语音回答</Text>
              <Text className="text-xs text-gray-400">
                {answer.audio.duration ? `${answer.audio.duration}s` : ''}
              </Text>
            </View>
          ) : null}
          {lists.length ? (
            <View className="mt-3">
              {lists.map((item, i) => (
                <View key={i} className="py-2 border-t border-gray-50 first:border-t-0">
                  {item.type === 'image' ? (
                    <Image className="w-full rounded-md" src={item.content} mode="widthFix" />
                  ) : (
                    <Text className="block text-sm text-gray-700 whitespace-pre-wrap">
                      {item.content}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mx-3 mt-3 mb-6 flex gap-2">
          <Button
            className="flex-1 text-sm rounded-md !bg-[#07c160] !text-white"
            onClick={onRegenerate}
          >
            再生成一个
          </Button>
          <Button
            className="flex-1 text-sm rounded-md !bg-gray-100 !text-gray-700"
            onClick={onShareFriend}
          >
            分享给好友
          </Button>
        </View>
      </ScrollView>
    </View>
  )
}
