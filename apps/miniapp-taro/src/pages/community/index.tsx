import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getCircleList } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

const defaultAvatar =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

// 8 类模型切换(对标原项目 ai_index.vue 的 8 类:skills/talk/image/video/audio/videoa/other/sck)
const modelTypes = [
  { icon: '💬', key: 'community.modelTypes.aiChat', path: '/pages/ai/chat' },
  { icon: '🎨', key: 'community.modelTypes.aiImage', path: '/pages/ai/image' },
  { icon: '🎬', key: 'community.modelTypes.aiVideo', path: '/pages/ai/video' },
  { icon: '🎙️', key: 'community.modelTypes.aiVoice', path: '/pages/ai/voice' },
  { icon: '⚡', key: 'community.modelTypes.agent', path: '/pages/ai/agent' },
  { icon: '🧠', key: 'community.modelTypes.digitalHuman', path: '/pages/ai/special' },
  { icon: '🏛️', key: 'community.modelTypes.modelPlaza', path: '/pages/model-plaza/index' },
  { icon: '🔧', key: 'community.modelTypes.moreTools', path: '/pages/ai/agent' },
]

// 快捷入口
const quickEntries = [
  { icon: '📝', key: 'community.quickEntries.myCreation', path: '/pages/aigc/list' },
  { icon: '🎨', key: 'community.quickEntries.aigcWorks', path: '/pages/aigc/publish' },
  { icon: '🏆', key: 'community.quickEntries.ranking', path: '/pages/ranking/index' },
  { icon: '👥', key: 'community.quickEntries.aiTeam', path: '/pages/ai-group/index' },
]

interface CircleItem {
  id: string
  title?: string
  content?: string
  authorName?: string
  authorAvatar?: string
  likeCount?: number
  createdAt?: string
}

export default function Community() {
  const { t } = useI18n()
  const [isLogin, setIsLogin] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [list, setList] = useState<CircleItem[]>([])
  const [loading, setLoading] = useState(false)

  function refreshUser() {
    setIsLogin(isLoggedIn())
    setUserInfo(getUserInfo())
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await getCircleList({ page: 1, pageSize: 10 })) as Record<string, unknown>
      setList((res?.list as CircleItem[]) || [])
    } catch {
      // 静默处理
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    refreshUser()
    loadData()
  })

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/login' })
  }

  function goPage(path: string) {
    Taro.switchTab({ url: path, fail: () => Taro.navigateTo({ url: path }) })
  }

  function onItemClick(id: string) {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${id}` })
  }

  // 微信分享
  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/community/index',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <View className="min-h-screen pb-[60px]">
      {/* 顶部用户信息条 — 青→紫赛博朋克渐变 + 科技网格 */}
      <View
        className="flex items-center pt-[60px] px-[16px] pb-[16px] tech-grid"
        style={{ background: 'linear-gradient(135deg, #00f2ff, #8b5cf6)' }}
      >
        <Image
          className="w-[40px] h-[40px] rounded-md border-[1px] border-solid border-white"
          src={userInfo?.avatar || defaultAvatar}
          mode="aspectFill"
        />
        <View className="ml-[10px] flex flex-col">
          <Text className="text-white text-[15px] font-semibold">
            {userInfo?.userName || userInfo?.nickname || (isLogin ? t('common.user') : t('home.tapLogin'))}
          </Text>
          <Text className="text-white text-[11px] opacity-90" onClick={!isLogin ? goLogin : undefined}>
            {t('community.title')} · {t('community.posts')}
          </Text>
        </View>
      </View>

      {/* 8 类模型切换 — 对标原项目 ai_index.vue */}
      <View className="mx-[16px] my-[12px] tech-card p-[12px]">
        <View className="flex justify-between items-center mb-[10px]">
          <Text className="text-[15px] font-semibold text-neon">{t('agent.title')}</Text>
          <Text className="text-[12px] text-muted-foreground" onClick={() => goPage('/pages/ai/agent')}>
            {t('home.more')} {'>'}
          </Text>
        </View>
        <View className="flex flex-wrap">
          {modelTypes.map((item) => (
            <View
              key={item.path + item.key}
              className="w-1/4 flex flex-col items-center py-[10px]"
              onClick={() => goPage(item.path)}
            >
              <View className="w-[44px] h-[44px] rounded-[10px] gradient-cyber flex items-center justify-center mb-[4px]">
                <Text className="text-[22px]">{item.icon}</Text>
              </View>
              <Text className="text-[11px] text-white">{t(item.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="mx-[16px] my-[12px] tech-card p-[12px]">
        <View className="flex">
          {quickEntries.map((entry) => (
            <View
              key={entry.path + entry.key}
              className="flex-1 flex flex-col items-center py-[8px]"
              onClick={() => goPage(entry.path)}
            >
              <Text className="text-[22px]">{entry.icon}</Text>
              <Text className="mt-[3px] text-[11px] text-white">{t(entry.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 社区动态流 */}
      <View className="mx-[16px] my-[12px]">
        <View className="flex justify-between items-center mb-[10px]">
          <Text className="text-[15px] font-semibold text-neon">{t('community.posts')}</Text>
          <Text
            className="text-[12px] text-muted-foreground"
            onClick={() => Taro.navigateTo({ url: '/pages/circle/index' })}
          >
            {t('home.more')} {'>'}
          </Text>
        </View>
        {loading ? (
          <View className="tech-card px-[16px] py-[20px] text-center">
            <Text className="text-[13px] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        ) : list.length > 0 ? (
          list.map((item) => (
            <View
              key={item.id}
              className="tech-card px-[12px] py-[12px] mb-[10px]"
              onClick={() => onItemClick(item.id)}
            >
              <View className="flex items-center mb-[6px]">
                <Image
                  className="w-[24px] h-[24px] rounded-md bg-muted"
                  src={item.authorAvatar || defaultAvatar}
                  mode="aspectFill"
                />
                <Text className="ml-[6px] text-[12px] text-muted-foreground">
                  {item.authorName || t('common.user')}
                </Text>
              </View>
              <Text className="block text-[14px] text-white font-semibold mb-[4px]">
                {item.title || t('aiCircle.post')}
              </Text>
              {item.content ? (
                <Text className="block text-[12px] text-muted-foreground text-ellipsis-2">
                  {item.content}
                </Text>
              ) : null}
              {item.likeCount ? (
                <Text className="block mt-[6px] text-[11px] text-[var(--color-primary)]">
                  ♥ {item.likeCount}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <View className="tech-card px-[16px] py-[40px] text-center">
            <Text className="text-[13px] text-muted-foreground">{t('common.empty')}</Text>
          </View>
        )}
      </View>

      {/* 发布动态入口 FAB(对标原社区发布按钮) */}
      <View
        className="fixed right-[32rpx] bottom-[120rpx] w-[96rpx] h-[96rpx] flex items-center justify-center bg-[var(--color-primary)] rounded-[24rpx] z-[10]"
        onClick={() => Taro.navigateTo({ url: '/pages/circle/create' })}
      >
        <Text className="text-[48rpx] text-white leading-none">+</Text>
      </View>
    </View>
  )
}
