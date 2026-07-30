import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline,
  usePullDownRefresh,
  useReachBottom,
} from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getCircleList } from '@/api'
import { useI18n } from '@/i18n'
import { aizhsUrl, bspappUrl } from '@/constants/icon-urls'
// 8 类模型切换背景图 + 箭头(Vite 编译时内联为 base64,对标原项目 ai_index.vue)
import activeBackSvg from '@/static/images/add/active_back.svg'
import backDefaultSvg from '@/static/images/add/back_default.svg'
import jiantouSvg from '@/static/images/add/jiantou.svg'
// 8 类模型图标(skills/talk/image/video/audio/videoa/other/sck)
import skillsIcon from '@/assets/images/add/skills.svg'
import talkIcon from '@/assets/images/add/talk.svg'
import imageIcon from '@/assets/images/add/image.svg'
import videoIcon from '@/assets/images/add/video.svg'
import audioIcon from '@/assets/images/add/audio.svg'
import videoaIcon from '@/assets/images/add/videoa.svg'
import otherIcon from '@/assets/images/add/other.svg'
import sckIcon from '@/assets/images/add/sck.svg'
import './index.css'

const defaultAvatar = '/static/default-avatar.png'

// 8 类模型切换(对标原项目 ai_index.vue:skills/talk/image/video/audio/videoa/other/sck)
type ModelTypeKey = 'skills' | 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other' | 'sck'

interface ModelTypeConfig {
  type: ModelTypeKey
  label: string
  icon: string
  path: string
}

const modelTypes: ModelTypeConfig[] = [
  { type: 'skills', label: '技能', icon: skillsIcon, path: '/pages/ai/agent' },
  { type: 'talk', label: '对话', icon: talkIcon, path: '/pages/ai/chat' },
  { type: 'image', label: '图像', icon: imageIcon, path: '/pages/ai/image' },
  { type: 'video', label: '视频', icon: videoIcon, path: '/pages/ai/video' },
  { type: 'audio', label: '语音', icon: audioIcon, path: '/pages/ai/voice' },
  { type: 'videoa', label: '视频+语音', icon: videoaIcon, path: '/pages/ai/special' },
  { type: 'other', label: '其他', icon: otherIcon, path: '/pages/model-plaza/index' },
  { type: 'sck', label: '创作', icon: sckIcon, path: '/pages/ai/agent' },
]

// 快捷入口(图标引用原项目远程图库:aizhs.top / bspapp.com)
const quickEntries = [
  {
    icon: aizhsUrl('sys-mini/penicon.png'),
    key: 'community.quickEntries.myCreation',
    path: '/pages/aigc/list',
  },
  {
    icon: aizhsUrl('sys-mini/xtk/aiWork.png'),
    key: 'community.quickEntries.aigcWorks',
    path: '/pages/aigc/publish',
  },
  {
    icon: bspappUrl('tabbar/home/zhongxia/king.png'),
    key: 'community.quickEntries.ranking',
    path: '/pages/ranking/index',
  },
  {
    icon: aizhsUrl('sys-mini/tuandui-icon.png'),
    key: 'community.quickEntries.aiTeam',
    path: '/pages/ai-group/index',
  },
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
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  // 8 类模型切换激活态(默认 skills,仅视觉反馈:active 时用 active_back.svg + 箭头旋转 180°)
  const [activeType, setActiveType] = useState<ModelTypeKey>('skills')

  function refreshUser() {
    setIsLogin(isLoggedIn())
    setUserInfo(getUserInfo())
  }

  const loadData = useCallback(
    async (reset = false) => {
      if (loading) return
      let curPage = page
      if (reset) {
        curPage = 1
        setHasMore(true)
        setList([])
        setPage(1)
      }
      if (!hasMore && !reset) return
      setLoading(true)
      try {
        const res = (await getCircleList({ page: curPage, pageSize: 10 })) as Record<
          string,
          unknown
        >
        const newList = (res?.list as CircleItem[]) || []
        setList((prev) => (reset ? newList : [...prev, ...newList]))
        setHasMore((reset ? newList.length : list.length + newList.length) < (res?.total as number))
        setPage(curPage + 1)
      } catch {
        // 静默处理
      } finally {
        setLoading(false)
      }
    },
    [loading, page, hasMore, list.length],
  )

  useDidShow(() => {
    refreshUser()
    loadData(true)
  })

  usePullDownRefresh(() => {
    loadData(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => loadData())

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/login' })
  }

  function goPage(path: string) {
    Taro.switchTab({ url: path, fail: () => Taro.navigateTo({ url: path }) })
  }

  function onItemClick(id: string) {
    Taro.navigateTo({ url: `/pages/circle/detail?id=${id}` })
  }

  // 8 类模型切换:设置激活态 + 跳转对应页面
  function onModelTypeSelect(cfg: ModelTypeConfig) {
    setActiveType(cfg.type)
    goPage(cfg.path)
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
    <View className="min-h-screen pb-[120rpx]">
      {/* 顶部用户信息条 — primary 实色背景 */}
      <View
        className="flex items-center pt-[120rpx] px-[32rpx] pb-[32rpx]"
        style={{ background: 'var(--color-primary)' }}
      >
        <Image
          className="w-[80rpx] h-[80rpx] rounded-md border-[2rpx] border-solid border-primary-foreground"
          src={userInfo?.avatar || defaultAvatar}
          mode="aspectFill"
        />
        <View className="ml-[20rpx] flex flex-col">
          <Text className="text-primary-foreground text-[30rpx] font-semibold">
            {userInfo?.userName ||
              userInfo?.nickname ||
              (isLogin ? t('common.user') : t('home.tapLogin'))}
          </Text>
          <Text
            className="text-primary-foreground text-[22rpx] opacity-90"
            onClick={!isLogin ? goLogin : undefined}
          >
            {t('community.title')} · {t('community.posts')}
          </Text>
        </View>
      </View>

      {/* 8 类模型切换 — 对标原项目 ai_index.vue model-type-btn(200rpx×60rpx 横向滚动渐变按钮)*/}
      <View className="mx-[32rpx] my-[24rpx] p-[24rpx]">
        <View className="flex justify-between items-center mb-[20rpx]">
          <Text className="text-[30rpx] font-semibold text-primary">{t('agent.title')}</Text>
          <Text
            className="text-[24rpx] text-muted-foreground"
            onClick={() => goPage('/pages/ai/agent')}
          >
            {t('home.more')} {'>'}
          </Text>
        </View>
        <ScrollView scrollX className="w-full whitespace-nowrap" enhanced showScrollbar={false}>
          <View className="inline-flex flex-row items-center" style={{ padding: '0 20rpx' }}>
            {modelTypes.map((item) => {
              const isActive = activeType === item.type
              return (
                <View
                  key={item.type}
                  className="ai-model-type-btn"
                  onClick={() => onModelTypeSelect(item)}
                >
                  {/* btn-bg 背景层(absolute 填充,选中态切换 SVG:active_back.svg / back_default.svg)*/}
                  <Image
                    className="absolute top-0 left-0"
                    src={isActive ? activeBackSvg : backDefaultSvg}
                    style={{
                      width: '100%',
                      height: '100%',
                      zIndex: 1,
                      opacity: isActive ? 1 : 0.6,
                    }}
                    mode="aspectFill"
                  />
                  {/* btn-content 内容层(图标 + 文字 20rpx,对标原项目 .btn-content)*/}
                  <View className="relative flex items-center" style={{ zIndex: 3 }}>
                    <Image
                      src={item.icon}
                      style={{ width: '28rpx', height: '28rpx' }}
                      mode="aspectFit"
                    />
                    <Text
                      style={{
                        fontSize: '20rpx',
                        color: 'rgba(0, 0, 0, 0.9)',
                        marginLeft: '6rpx',
                      }}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {/* btn-arrow 箭头(选中时 rotate 180°,对标原项目 .btn-arrow.rotate)*/}
                  <Image
                    src={jiantouSvg}
                    className={`ai-btn-arrow ${isActive ? 'ai-btn-arrow-rotate' : ''}`}
                    style={{
                      position: 'relative',
                      zIndex: 3,
                      width: '20rpx',
                      height: '20rpx',
                      marginLeft: '6rpx',
                    }}
                    mode="aspectFit"
                  />
                </View>
              )
            })}
          </View>
        </ScrollView>
      </View>

      {/* 快捷入口 */}
      <View className="mx-[32rpx] my-[24rpx] p-[24rpx]">
        <View className="flex">
          {quickEntries.map((entry) => (
            <View
              key={entry.path + entry.key}
              className="flex-1 flex flex-col items-center py-[16rpx]"
              onClick={() => goPage(entry.path)}
            >
              <Image src={entry.icon} className="w-[44rpx] h-[44rpx]" mode="aspectFit" />
              <Text className="mt-[6rpx] text-[22rpx] text-foreground">{t(entry.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 社区动态流 */}
      <View className="mx-[32rpx] my-[24rpx]">
        <View className="flex justify-between items-center mb-[20rpx]">
          <Text className="text-[30rpx] font-semibold text-primary">{t('community.posts')}</Text>
          <Text
            className="text-[24rpx] text-muted-foreground"
            onClick={() => Taro.navigateTo({ url: '/pages/circle/index' })}
          >
            {t('home.more')} {'>'}
          </Text>
        </View>
        {loading ? (
          <View className="px-[32rpx] py-[40rpx] text-center">
            <Text className="text-[26rpx] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        ) : list.length > 0 ? (
          list.map((item) => (
            <View
              key={item.id}
              className="px-[24rpx] py-[24rpx] mb-[20rpx]"
              onClick={() => onItemClick(item.id)}
            >
              <View className="flex items-center mb-[12rpx]">
                <Image
                  className="w-[48rpx] h-[48rpx] rounded-md bg-muted"
                  src={item.authorAvatar || defaultAvatar}
                  mode="aspectFill"
                />
                <Text className="ml-[12rpx] text-[24rpx] text-muted-foreground">
                  {item.authorName || t('common.user')}
                </Text>
              </View>
              <Text className="block text-[28rpx] text-foreground font-semibold mb-[8rpx]">
                {item.title || t('aiCircle.post')}
              </Text>
              {item.content ? (
                <Text className="block text-[24rpx] text-muted-foreground text-ellipsis-2">
                  {item.content}
                </Text>
              ) : null}
              {item.likeCount ? (
                <View className="flex items-center gap-[6rpx] mt-[12rpx]">
                  <Image
                    src={bspappUrl('tabbar/home/xia/Like.png')}
                    className="w-[24rpx] h-[24rpx]"
                    mode="aspectFit"
                  />
                  <Text className="text-[22rpx] text-[var(--color-primary)]">{item.likeCount}</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <View className="px-[32rpx] py-[80rpx] text-center">
            <Text className="text-[26rpx] text-muted-foreground">{t('common.empty')}</Text>
          </View>
        )}

        {/* 分页加载状态 */}
        {loading && list.length > 0 ? (
          <View className="px-[32rpx] py-[24rpx] text-center">
            <Text className="text-[24rpx] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        ) : null}
        {!loading && !hasMore && list.length > 0 ? (
          <View className="px-[32rpx] py-[24rpx] text-center">
            <Text className="text-[24rpx] text-muted-foreground">{t('common.noMore')}</Text>
          </View>
        ) : null}
      </View>

      {/* 发布动态入口 FAB(对标原社区发布按钮) */}
      <View
        className="fixed right-[32rpx] bottom-[120rpx] w-[96rpx] h-[96rpx] flex items-center justify-center bg-[var(--color-primary)] rounded-[24rpx] z-[10]"
        onClick={() => Taro.navigateTo({ url: '/pages/circle/create' })}
      >
        <Text className="text-[48rpx] text-primary-foreground leading-none">+</Text>
      </View>
    </View>
  )
}
