import { View, Text, Image, Slider } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useMemo, useCallback, useRef } from 'react'
import { isLoggedIn, getUserInfo, clearAuth, type UserInfo } from '@/utils/auth'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { icon } from '@/constants/remote-icons'
import NavBar from '@/components/NavBar'
import DrawerComponent, { type DrawerModelGroup, type DrawerChatItem } from '@/components/DrawerComponent'
import UserInfoCard from '@/components/UserInfoCard'
import LoginPopUp from '@/components/LoginPopUp'
import StudyBar from '@/components/StudyBar'
import { FloatBox, VideoPlayer } from '@/components'
import { rpx } from '@/utils/rpx'
import UserCard from './components/UserCard'
// 本地化远程 CDN 图标（原 cdn.bspapp.com / file.aizhs.top 在 H5 模式下加载失败）
import aiIconLocal from '@/assets/remote-images/ai-icon.svg'
import courseIconLocal from '@/assets/remote-images/course-icon.svg'
import vipActIconLocal from '@/assets/remote-images/user-vip-act.svg'
import dingdanIcon from '@/assets/remote/images/dingdan.jpg'
import gerenIcon from '@/assets/remote/images/geren-icon.png'
import shezhiIcon from '@/assets/remote/images/shezhi.png'
import gonggaoIcon from '@/assets/remote/images/gonggao.png'
import playIcon from '@/assets/remote/images/play.svg'
import pauseIcon from '@/assets/remote/images/pause.svg'
import downloadIcon from '@/assets/remote/images/download.png'
import yejiaoIcon from '@/assets/remote/images/yejiao.png'
import backSvg from '@/assets/remote/images/back.svg'
import './index.css'

const defaultAvatar =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

// 状态栏高度（对齐原项目 statusBarHeight，用于 DrawerComponent 顶部 padding）
const menuButton = Taro.getMenuButtonBoundingClientRect?.() || { top: 26, height: 32 }
const statusBarHeight = menuButton.top

// 判断 icon 是否为图片路径(http(s):// 远程 URL 或 / 开头本地路径),非图片视为 emoji
function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

// 统一渲染 icon:图片路径 → <Image>,emoji → <Text>
function renderIcon(iconStr: string, emojiClass: string, imgClass: string) {
  if (isImagePath(iconStr)) {
    return <Image src={iconStr} className={imgClass} mode="aspectFit" />
  }
  return <Text className={emojiClass}>{iconStr}</Text>
}

const quickEntries = [
  { icon: dingdanIcon, key: 'user.menu.orders', path: '/pages/user/orders' },
  { icon: icon('shoucang'), key: 'user.menu.favorites', path: '/pages/favorites/index' },
  { icon: gerenIcon, key: 'user.menu.following', path: '/pages/following/index' },
  { icon: gonggaoIcon, key: 'user.menu.subscriptions', path: '/pages/subscriptions/index' },
]

const menus = [
  { icon: courseIconLocal, key: 'user.menu.courses', path: '/pages/course/list' },
  { icon: aiIconLocal, key: 'user.menu.ai', path: '/pages/ai/chat' },
  { icon: shezhiIcon, key: 'user.menu.settings', path: '/pages/user/settings' },
]

// 会员权益项:对齐原项目 UserMembershipBenefits 3 项数据(原项目 index.vue:297-310)
// i18n key 不存在时用中文 fallback(后续补 key 后自动切换)
const membershipBenefits: ReadonlyArray<{ icon: string; key: string; fallback: string }> = [
  { icon: aiIconLocal, key: 'user.benefits.aiAssistant', fallback: 'AI助手免费使用次数增加' },
  { icon: courseIconLocal, key: 'user.benefits.freeCourses', fallback: '部分课程免费学习' },
  { icon: vipActIconLocal, key: 'user.benefits.knowledgeBase', fallback: '建立专属知识库' },
]

// 格式化音频时间（秒 → mm:ss）
function formatAudioTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`
}

export default function UserIndex() {
  const { t } = useI18n()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [showBenefits, setShowBenefits] = useState<boolean>(false)
  // isshow: 对齐原项目，iOS 设备标识（UserCard 和会员权益在非 iOS 设备上显示）
  const [isshow] = useState<boolean>(() => {
    try {
      const systemInfo = Taro.getSystemInfoSync()
      return systemInfo.platform === 'ios'
    } catch {
      return false
    }
  })
  const [activeTab, setActiveTab] = useState<number>(1)
  const [textContentList, setTextContentList] = useState<Array<{title: string; time: string; content: string}>>([])
  const [imageContentList, setImageContentList] = useState<Array<{title: string; time: string; imageList: string[]}>>([])
  const [videoContentList, setVideoContentList] = useState<Array<{title: string; time: string; videoUrl: string}>>([])
  const [audioContentList, setAudioContentList] = useState<Array<{title: string; time: string; audioUrl: string}>>([])
  const [contentLoading, setContentLoading] = useState<boolean>(false)
  // 音频播放状态
  const [audioPlayStates, setAudioPlayStates] = useState<Record<number, boolean>>({})
  const [audioProgress, setAudioProgress] = useState<Record<number, number>>({})
  const [audioCurrentTime, setAudioCurrentTime] = useState<Record<number, number>>({})
  const audioContextsRef = useRef<Record<number, Taro.InnerAudioContext>>({})
  // 视频播放弹窗
  const [showVideoPlayer, setShowVideoPlayer] = useState<boolean>(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string>('')
  // 登录弹窗
  const [showLoginPopup, setShowLoginPopup] = useState<boolean>(false)
  // 侧边栏抽屉
  const [showDrawer, setShowDrawer] = useState<boolean>(false)
  // 历史对话分组数据（对齐原项目 groupedData，实际由 API 填充）
  const [groupedData, setGroupedData] = useState<DrawerModelGroup[]>([])
  // 分享弹窗
  const [showSharePopup, setShowSharePopup] = useState<boolean>(false)

  const isLogin = useMemo(() => !!userInfo, [userInfo])

  const refresh = useCallback(() => {
    setUserInfo(isLoggedIn() ? getUserInfo() : null)
  }, [])

  // 按日期分组(对齐原项目 groupDataByDate)
  const groupDataByDate = useCallback(
    (
      chats: Array<{ id: string; title: string; time: string; modelName?: string }>,
    ): DrawerModelGroup[] => {
      const modelMap = new Map<string, Array<{ id: string; title: string; time: string; modelName?: string }>>()
      for (const chat of chats) {
        const modelName = chat.modelName || '默认模型'
        if (!modelMap.has(modelName)) modelMap.set(modelName, [])
        modelMap.get(modelName)!.push(chat)
      }
      return Array.from(modelMap.entries()).map(([modelName, modelChats]) => {
        const dateMap = new Map<string, Array<{ id: string | number; title: string; date: string }>>()
        for (const chat of modelChats) {
          const dateKey = chat.time ? chat.time.slice(0, 7) : '最近' // YYYY-MM 分组
          if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
          dateMap.get(dateKey)!.push({ id: chat.id, title: chat.title, date: chat.time })
        }
        return {
          modelName,
          dateGroups: Array.from(dateMap.entries()).map(([date, items]) => ({ date, chats: items })),
        }
      })
    },
    [],
  )

  // 加载历史对话(对齐原项目 loadHistoryChat)
  const loadHistoryChat = useCallback(async () => {
    try {
      const res = (await api.getChatHistory({ page: 1, pageSize: 20 })) as {
        list?: Array<{ id: string; title: string; time: string; messages?: unknown[] }>
      }
      const rawList = Array.isArray(res?.list) ? res.list : []
      setGroupedData(
        groupDataByDate(rawList.map((c) => ({ id: c.id, title: c.title, time: c.time }))),
      )
    } catch {
      setGroupedData([])
    }
  }, [groupDataByDate])

  // 加载内容数据(对齐原项目 loadContentByTab)
  const loadContentByTab = useCallback(async (tabId: number) => {
    setContentLoading(true)
    try {
      const res = (await api.getMyCreation({ type: tabId, page: 1, pageSize: 10 })) as {
        list?: unknown[]
      }
      const rawList = Array.isArray(res?.list) ? res.list : []
      if (tabId === 1) {
        setTextContentList(
          rawList.map((r) => {
            const item = r as Record<string, unknown>
            return {
              title: String(item['title'] ?? ''),
              time: String(item['time'] ?? item['createTime'] ?? ''),
              content: String(item['content'] ?? ''),
            }
          }),
        )
      } else if (tabId === 2) {
        setImageContentList(
          rawList.map((r) => {
            const item = r as Record<string, unknown>
            return {
              title: String(item['title'] ?? ''),
              time: String(item['time'] ?? item['createTime'] ?? ''),
              imageList: Array.isArray(item['imageList']) ? (item['imageList'] as string[]) : [],
            }
          }),
        )
      } else if (tabId === 3) {
        setVideoContentList(
          rawList.map((r) => {
            const item = r as Record<string, unknown>
            return {
              title: String(item['title'] ?? ''),
              time: String(item['time'] ?? item['createTime'] ?? ''),
              videoUrl: String(item['videoUrl'] ?? ''),
            }
          }),
        )
      } else if (tabId === 4) {
        setAudioContentList(
          rawList.map((r) => {
            const item = r as Record<string, unknown>
            return {
              title: String(item['title'] ?? ''),
              time: String(item['time'] ?? item['createTime'] ?? ''),
              audioUrl: String(item['audioUrl'] ?? ''),
            }
          }),
        )
      }
    } catch {
      if (tabId === 1) setTextContentList([])
      else if (tabId === 2) setImageContentList([])
      else if (tabId === 3) setVideoContentList([])
      else if (tabId === 4) setAudioContentList([])
    } finally {
      setContentLoading(false)
    }
  }, [])

  const maskPhone = useCallback((phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }, [])

  const toggleBenefits = useCallback(() => setShowBenefits((v) => !v), [])

  // i18n key 不存在时(t 返回 key 本身)回退到中文文案
  const tf = useCallback(
    (key: string, fallback: string): string => {
      const v = t(key)
      return v === key ? fallback : v
    },
    [t],
  )

  function goLogin() {
    // 未登录时显示登录弹窗（对齐原项目 loginPopUp）
    setShowLoginPopup(true)
  }

  function goPage(path: string) {
    Taro.navigateTo({ url: path })
  }

  function handleLogout() {
    Taro.showModal({
      title: t('common.hint'),
      content: t('user.logoutConfirm'),
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.logout()
          } catch {
            // 忽略退出接口错误
          }
          clearAuth()
          setUserInfo(null)
          Taro.showToast({ title: t('user.loggedOut'), icon: 'success' })
        }
      },
    })
  }

  // 图片预览（对齐原项目 previewImage）
  function previewImage(currentUrl: string, urlList: string[]) {
    Taro.previewImage({
      current: currentUrl,
      urls: urlList || [currentUrl],
    })
  }

  // 切换音频播放/暂停（对齐原项目 toggleAudioPlay）
  function toggleAudioPlay(index: number, audioUrl: string) {
    const isPlaying = !audioPlayStates[index]
    setAudioPlayStates((prev) => ({ ...prev, [index]: isPlaying }))

    if (isPlaying) {
      const audioContext = Taro.createInnerAudioContext()
      audioContext.src = audioUrl
      audioContext.volume = 1

      audioContextsRef.current[index] = audioContext

      audioContext.onTimeUpdate(() => {
        const duration = audioContext.duration || 0
        const currentTime = audioContext.currentTime || 0
        const progress = duration > 0 ? (currentTime / duration) * 100 : 0
        setAudioProgress((prev) => ({ ...prev, [index]: progress }))
        setAudioCurrentTime((prev) => ({ ...prev, [index]: currentTime }))
      })

      audioContext.onEnded(() => {
        setAudioPlayStates((prev) => ({ ...prev, [index]: false }))
        setAudioProgress((prev) => ({ ...prev, [index]: 100 }))
        setAudioCurrentTime((prev) => ({ ...prev, [index]: audioContext.duration || 0 }))
        cleanupAudioContext(index)
      })

      audioContext.onError(() => {
        setAudioPlayStates((prev) => ({ ...prev, [index]: false }))
        cleanupAudioContext(index)
      })

      audioContext.play()
    } else {
      const audioContext = audioContextsRef.current[index]
      if (audioContext) {
        audioContext.pause()
        cleanupAudioContext(index)
      }
    }
  }

  // 清理音频上下文（对齐原项目 cleanupAudioContext）
  function cleanupAudioContext(index: number) {
    const audioContext = audioContextsRef.current[index]
    if (audioContext) {
      audioContext.stop()
      audioContext.destroy()
      delete audioContextsRef.current[index]
    }
  }

  // 处理音频进度条变化（对齐原项目 onAudioProgressChange）
  function onAudioProgressChange(index: number, e: { detail: { value: number } }) {
    const progress = e.detail.value
    setAudioProgress((prev) => ({ ...prev, [index]: progress }))

    const audioContext = audioContextsRef.current[index]
    if (audioContext && audioContext.duration) {
      const seekTime = (progress / 100) * audioContext.duration
      audioContext.seek(seekTime)
      setAudioCurrentTime((prev) => ({ ...prev, [index]: seekTime }))
    }
  }

  // 下载音频（对齐原项目 downloadAudio）
  function downloadAudio(audioUrl: string) {
    if (!audioUrl) {
      Taro.showToast({
        title: tf('user.audio.invalidUrl', '音频地址无效'),
        icon: 'none',
      })
      return
    }

    Taro.showLoading({
      title: tf('user.audio.preparing', '准备下载...'),
    })

    const downloadTask = Taro.downloadFile({
      url: audioUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          Taro.showLoading({
            title: tf('user.audio.saving', '保存中...'),
          })

          Taro.saveFile({
            tempFilePath: res.tempFilePath,
            success: () => {
              Taro.hideLoading()
              Taro.showToast({
                title: tf('user.audio.downloadSuccess', '下载成功'),
                icon: 'success',
              })
            },
            fail: () => {
              Taro.hideLoading()
              Taro.showToast({
                title: tf('user.audio.downloadFail', '保存失败'),
                icon: 'none',
              })
            },
          })
        } else {
          Taro.hideLoading()
          Taro.showToast({
            title: tf('user.audio.downloadFail', '下载失败'),
            icon: 'none',
          })
        }
      },
      fail: () => {
        Taro.hideLoading()
        Taro.showToast({
          title: tf('user.audio.downloadFail', '下载失败'),
          icon: 'none',
        })
      },
    })

    downloadTask.onProgressUpdate((res) => {
      Taro.showLoading({
        title: `${tf('user.audio.downloading', '下载中...')} ${res.progress}%`,
      })
    })
  }

  // 打开视频播放器（对齐原项目 openVideoPlayer）
  function openVideoPlayer(videoUrl: string) {
    if (!videoUrl) {
      Taro.showToast({
        title: tf('user.video.invalidUrl', '视频地址无效'),
        icon: 'none',
      })
      return
    }
    setCurrentVideoUrl(videoUrl)
    setShowVideoPlayer(true)
  }

  // 关闭视频播放器
  function closeVideoPlayer() {
    setShowVideoPlayer(false)
    setCurrentVideoUrl('')
  }

  // 处理反馈按钮点击（对齐原项目 @feedback-click → handleFeedbackClick）
  function handleFeedbackClick() {
    // 对齐原项目 /pagesA/fankui/index?pageType=list
    Taro.navigateTo({
      url: '/pages/feedback/index?pageType=list',
      fail: () => Taro.navigateTo({ url: '/pages/feedback/index' }),
    })
  }

  // 处理返回首页（对齐原项目 @pack → onPackClick）
  function onPackClick() {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  // 复制官网链接（对齐原项目 copyWebsiteLink）
  function copyWebsiteLink() {
    const websiteUrl = 'https://www.aizhs.top'
    Taro.setClipboardData({
      data: websiteUrl,
      success: () => {
        Taro.showToast({
          title: tf('user.websiteLinkCopied', '已复制官网地址，请在浏览器打开'),
          icon: 'none',
          duration: 2000,
        })
      },
      fail: () => {
        Taro.showToast({
          title: tf('user.websiteLinkFail', '复制失败，请重试'),
          icon: 'none',
          duration: 2000,
        })
      },
    })
  }

  // 打开/关闭侧边栏抽屉
  const toggleDrawer = useCallback(() => {
    setShowDrawer((v) => !v)
  }, [])

  // 分享弹窗
  const openSharePopup = useCallback(() => {
    setShowSharePopup(true)
  }, [])

  const closeSharePopup = useCallback(() => {
    setShowSharePopup(false)
  }, [])

  // 历史对话项点击回调（对齐原项目 onChatItemClick）
  const handleChatItemClick = useCallback((chat: DrawerChatItem) => {
    toggleDrawer()
    // 对齐原项目 handleShowFullList:携带 chatId + title 参数
    Taro.navigateTo({
      url: `/pages/ai/chat?chatId=${chat.id}&title=${encodeURIComponent(chat.title)}`,
      fail: () => Taro.showToast({ title: '对话页未配置', icon: 'none' }),
    })
  }, [toggleDrawer])

  // 会员权益点击跳转
  const goVipDetail = useCallback(() => {
    // 对齐原项目 openIntroduce/openIntroduces/openIntroduces2:按 isVip 分流
    const isVip = userInfo?.isVip ? 1 : 0
    const routeMap: Record<number, string> = {
      0: '/pages/vip/index?type=IntroducePopup', // 非会员:开通 VIP
      1: '/pages/vip/index?type=IntroducePopups', // 会员:成为操盘手
      2: '/pages/vip/index?type=PrivateAdvisory', // 操盘手:加入私董会
    }
    // noUncheckedIndexedAccess 下 routeMap[isVip] 为 string | undefined,用 ?? 兜底
    const url = routeMap[isVip] ?? '/pages/vip/index'
    Taro.navigateTo({ url, fail: () => Taro.navigateTo({ url: '/pages/vip/index' }) })
  }, [userInfo?.isVip])

  // 对齐原项目 tabList
  const tabList = useMemo(
    () => [
      { id: 1, name: tf('user.tab.text', '文本') },
      { id: 2, name: tf('user.tab.image', '图片') },
      { id: 3, name: tf('user.tab.video', '视频') },
      { id: 4, name: tf('user.tab.audio', '音频') },
    ],
    [tf],
  )

  // 对齐原项目 handleTabChange
  function handleTabChange(item: { id: number; name: string }) {
    setActiveTab(item.id)
    void loadContentByTab(item.id)
  }

  // 编辑个人资料
  const goProfile = useCallback(() => {
    if (!isLogin) {
      goLogin()
      return
    }
    Taro.navigateTo({ url: '/pages/user/profile' })
  }, [isLogin])

  useDidShow(() => {
    refresh()
    void loadContentByTab(1) // 默认加载文本 tab
    void loadHistoryChat()
  })

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/index/index',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <View className="min-h-screen pb-[40rpx]" style={{ background: 'var(--color-background)' }}>
      {/* ===== DrawerComponent 侧边栏抽屉（对齐原项目结构：outContainer → DrawerComponent → FloatBox → navigation-bars） ===== */}
      <DrawerComponent
        visible={showDrawer}
        onClose={toggleDrawer}
        side="left"
        statusBarHeight={statusBarHeight}
        groupedData={groupedData}
        userinfo={
          userInfo
            ? { avatar: userInfo.avatar, nickname: userInfo.userName || userInfo.nickname }
            : undefined
        }
        onMenuItemClick={(item) => {
          toggleDrawer()
          // 根据菜单项 key 跳转不同页面
          const menuRouteMap: Record<string, string> = {
            appStore: '/pages/index/index',
            demand: '/pages/demand/index',
            inspiration: '/pages/inspiration/index',
            dynamic: '/pages/dynamic/index',
            course: '/pages/course/list',
          }
          const route = menuRouteMap[item.key]
          if (route) Taro.navigateTo({ url: route })
        }}
        onLabelItemClick={(item) => {
          toggleDrawer()
          const labelRouteMap: Record<string, string> = {
            company: '/pages/company/index',
            freebie: '/pages/freebie/index',
          }
          const route = labelRouteMap[item.key]
          if (route) Taro.navigateTo({ url: route })
        }}
        onChatItemClick={handleChatItemClick}
        onCreateChat={() => {
          toggleDrawer()
          Taro.switchTab({ url: '/pages/index/index' })
        }}
        onRemoveChat={(chat) => {
          Taro.showModal({
            title: '提示',
            content: '确定删除此对话?',
            success: async (res) => {
              if (res.confirm) {
                try {
                  await api.removeModelChat(String(chat.id))
                  Taro.showToast({ title: '已删除', icon: 'success' })
                  void loadHistoryChat()
                } catch {
                  Taro.showToast({ title: '删除失败', icon: 'none' })
                }
              }
            },
          })
        }}
      />

      {/* ===== FloatBox 浮动组件 ===== */}
      <FloatBox />

      {/* ===== 导航栏(对齐原项目 navigation-bars: showFeedback / @pack / @feedback-click / @menu-click) ===== */}
      <NavBar
        variant="ai-home"
        title={tf('user.title', '我的')}
        bgColor="transparent"
        textColor="#fff"
        showFeedback
        onMenuClick={toggleDrawer}
        onFeedbackClick={handleFeedbackClick}
        onPack={onPackClick}
      />

      {/* ===== 用户信息头部 ===== */}
      <View
        className="pt-[120rpx] px-[20rpx] pb-[48rpx]"
        style={{ background: 'var(--color-primary)' }}
      >
        {userInfo ? (
          <View className="flex items-center">
            {/* 使用 UserInfoCard 替换内联用户信息 */}
            <View className="flex-1">
              <UserInfoCard
                avatar={userInfo.avatar}
                nickname={userInfo.userName || userInfo.nickname || t('common.user')}
                isVip={!!userInfo.isVip}
                vipTitle={userInfo.isVip ? 'VIP' : undefined}
                desc={userInfo.phone ? maskPhone(userInfo.phone) : undefined}
                onClick={goProfile}
              />
            </View>
            {/* 分享按钮 */}
            <View
              className="ml-[20rpx] flex-shrink-0 w-[72rpx] h-[72rpx] rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              onClick={openSharePopup}
            >
              <Text className="text-[32rpx] text-white font-bold">⤴</Text>
            </View>
          </View>
        ) : (
          <View className="flex items-center" onClick={goLogin}>
            <Image
              className="w-[120rpx] h-[120rpx] rounded-md border-[4rpx] border-solid border-primary-foreground"
              src={defaultAvatar}
              mode="aspectFill"
            />
            <View className="ml-[24rpx]">
              <Text className="block text-primary-foreground text-[36rpx] font-semibold">
                {t('user.tapLogin')}
              </Text>
              <Text className="block mt-[8rpx] text-primary-foreground text-[24rpx] opacity-85">
                {t('user.loginHint')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ===== LoginPopUp 登录弹窗（对齐原项目 loginPopUp） ===== */}
      <LoginPopUp
        visible={showLoginPopup}
        defaultAvatar={defaultAvatar}
        userInfo={
          userInfo
            ? {
                nickname: userInfo.nickname || userInfo.userName,
                avatar: userInfo.avatar,
                isVip: userInfo.isVip ? 1 : 0,
                identityTypy: 0,
              }
            : undefined
        }
        onClose={() => setShowLoginPopup(false)}
        onUpgrade={goVipDetail}
        onNicknameChange={async (nickname) => {
          if (!userInfo) return
          try {
            await api.bindUser({ nickname, userId: userInfo.id || userInfo.uuid })
            setUserInfo({ ...userInfo, nickname })
            Taro.showToast({ title: '保存成功', icon: 'success' })
          } catch {
            Taro.showToast({ title: '保存失败', icon: 'none' })
          }
        }}
      />

      {/* ===== UserCard 功能卡片（对齐原项目 user_cards.vue，非 iOS 显示） ===== */}
      {!isshow ? (
        <View className="mx-[20rpx]">
          <UserCard onGoPage={goPage} />
        </View>
      ) : null}

      {/* ===== 会员权益卡片（对齐原项目 membership-benefits-container：箭头旋转动画 + bounce 动画） ===== */}
      {!isshow ? (
        <View className="membership-benefits-container mx-[20rpx] mt-[24rpx] mb-0">
          {/* 箭头头部：点击展开/收起（对齐原项目 membership-benefits-header @click="toggleMembershipBenefits"） */}
          <View
            className="membership-benefits-header"
            onClick={toggleBenefits}
          >
            <View
              className={`membership-benefits-arrow ${showBenefits ? 'arrow-rotate' : ''}`}
            >
              <Image
                className="arrow-icon"
                src={backSvg}
                mode="aspectFit"
              />
            </View>
          </View>
          {/* 会员权益内容（对齐原项目 membership-benefits-content v-show="showMembershipBenefits"） */}
          {showBenefits ? (
            <View className="membership-benefits-content">
              <View className="flex flex-wrap px-[8rpx] pb-[16rpx] bg-card border border-border rounded-lg">
                {membershipBenefits.map((b) => (
                  <View key={b.key} className="w-1/3 flex flex-col items-center py-[16rpx]">
                    {renderIcon(b.icon, 'text-[44rpx]', 'w-[44rpx] h-[44rpx]')}
                    <Text className="mt-[8rpx] text-[24rpx] text-foreground text-center">
                      {tf(b.key, b.fallback)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ===== StudyBar + 内容展示区 ===== */}
      <View className="content-display-area">
        {/* StudyBar Tab 切换 — 对齐原项目 <StudyBar :barList="tabList" @change="handleTabChange" /> */}
        <StudyBar barList={tabList} onChange={handleTabChange} />

        {/* 内容展示区 */}
        <View className="content-list">
          {/* 加载状态(对齐原项目 contentLoading) */}
          {contentLoading ? (
            <View className="py-[40rpx] flex items-center justify-center">
              <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                {tf('common.loading', '加载中...')}
              </Text>
            </View>
          ) : null}
          {/* 文本内容 */}
          {activeTab === 1 && (
            <View>
              {textContentList.length === 0 ? (
                <View className="py-[120rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.text', '暂无文本内容')}
                  </Text>
                </View>
              ) : (
                textContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[28rpx] border border-border shadow-sm">
                    <View className="flex-row items-center justify-between mb-[12rpx]">
                      <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-[22rpx] text-muted-foreground">{item.time}</Text>
                    </View>
                    <Text className="text-[26rpx] text-muted-foreground leading-[1.6]">{item.content}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* 图片内容 */}
          {activeTab === 2 && (
            <View>
              {imageContentList.length === 0 ? (
                <View className="py-[120rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.image', '暂无图片内容')}
                  </Text>
                </View>
              ) : (
                imageContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[28rpx] border border-border shadow-sm">
                    <View className="flex-row items-center justify-between mb-[12rpx]">
                      <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-[22rpx] text-muted-foreground">{item.time}</Text>
                    </View>
                    <View className="flex flex-row flex-wrap" style={{ gap: rpx(8) }}>
                      {(item.imageList || []).map((imgUrl, imgIdx) => (
                        <Image
                          key={imgIdx}
                          src={imgUrl}
                          mode="aspectFill"
                          style={{ width: rpx(200), height: rpx(200), borderRadius: rpx(12) }}
                          onClick={() => previewImage(imgUrl, item.imageList)}
                        />
                      ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* 视频内容 */}
          {activeTab === 3 && (
            <View>
              {videoContentList.length === 0 ? (
                <View className="py-[120rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.video', '暂无视频内容')}
                  </Text>
                </View>
              ) : (
                videoContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg overflow-hidden border border-border shadow-sm">
                    <View className="flex-row items-center justify-between p-[24rpx] pb-[12rpx]">
                      <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-[22rpx] text-muted-foreground">{item.time}</Text>
                    </View>
                    <View
                      className="relative mx-[24rpx] mb-[24rpx] rounded-lg overflow-hidden bg-muted"
                      style={{ height: rpx(400) }}
                      onClick={() => openVideoPlayer(item.videoUrl)}
                    >
                      <View className="absolute inset-0 flex items-center justify-center">
                        <View className="w-[120rpx] h-[120rpx] rounded-full bg-black/50 flex items-center justify-center">
                          <Image src={playIcon} mode="aspectFit" className="w-[60rpx] h-[60rpx]" />
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* 音频内容 */}
          {activeTab === 4 && (
            <View>
              {audioContentList.length === 0 ? (
                <View className="py-[120rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.audio', '暂无音频内容')}
                  </Text>
                </View>
              ) : (
                audioContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[28rpx] border border-border shadow-sm">
                    <View className="flex-row items-center justify-between mb-[12rpx]">
                      <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-[22rpx] text-muted-foreground">{item.time}</Text>
                    </View>
                    <View className="flex-row items-center gap-[12rpx]">
                      {/* 播放/暂停按钮 */}
                      <View
                        className="w-[48rpx] h-[48rpx] rounded-full flex items-center justify-center"
                        style={{ background: 'var(--color-primary)', flexShrink: 0 }}
                        onClick={() => toggleAudioPlay(index, item.audioUrl)}
                      >
                        <Image
                          src={audioPlayStates[index] ? pauseIcon : playIcon}
                          mode="aspectFit"
                          className="w-[36rpx] h-[36rpx]"
                        />
                      </View>
                      {/* 进度条 */}
                      <View className="flex-1" style={{ minWidth: 0 }}>
                        <Slider
                          value={audioProgress[index] || 0}
                          min={0}
                          max={100}
                          activeColor="var(--color-primary)"
                          backgroundColor="rgba(255,255,255,0.15)"
                          blockSize={12}
                          blockColor="var(--color-primary)"
                          onChange={(e) => onAudioProgressChange(index, e)}
                        />
                      </View>
                      {/* 当前时间 */}
                      <Text className="text-[22rpx] text-muted-foreground" style={{ flexShrink: 0, width: rpx(80), textAlign: 'right' }}>
                        {formatAudioTime(audioCurrentTime[index] || 0)}
                      </Text>
                      {/* 下载按钮 */}
                      <Image
                        src={downloadIcon}
                        mode="aspectFit"
                        className="w-[36rpx] h-[36rpx]"
                        style={{ flexShrink: 0 }}
                        onClick={() => downloadAudio(item.audioUrl)}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      </View>

      {/* 快捷入口 */}
      <View className="mx-[20rpx] my-[24rpx] py-[28rpx]">
        <View className="flex">
          {quickEntries.map((entry) => (
            <View
              key={entry.path}
              className="flex-1 flex flex-col items-center"
              onClick={() => goPage(entry.path)}
            >
              {renderIcon(entry.icon, 'text-[44rpx]', 'w-[44rpx] h-[44rpx]')}
              <Text className="mt-[6rpx] text-[24rpx] text-foreground">{t(entry.key)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 功能列表 */}
      <View className="mx-[20rpx] my-[24rpx] overflow-hidden">
        {menus.map((item, idx) => (
          <View
            key={item.path}
            className={`flex items-center px-[32rpx] py-[32rpx] ${
              idx < menus.length - 1 ? 'mb-[8rpx]' : ''
            }`}
            onClick={() => goPage(item.path)}
          >
            {renderIcon(item.icon, 'text-[40rpx]', 'w-[40rpx] h-[40rpx]')}
            <Text className="flex-1 ml-[20rpx] text-[30rpx] text-foreground">{t(item.key)}</Text>
            <Text className="text-[26rpx] text-[var(--color-primary)]">{'>'}</Text>
          </View>
        ))}
      </View>

      {/* 退出登录 */}
      {isLogin ? (
        <View
          className="mx-[20rpx] my-[48rpx] h-[96rpx] leading-[96rpx] text-center border border-primary text-primary rounded-lg text-[30rpx]"
          onClick={handleLogout}
        >
          <Text>{t('user.logout')}</Text>
        </View>
      ) : null}

      {/* 官网链接 */}
      <View className="w-full flex items-center justify-center pb-[20rpx]">
        <Image
          src={yejiaoIcon}
          mode="widthFix"
          className="w-[348rpx]"
          onClick={copyWebsiteLink}
        />
      </View>

      {/* ===== 视频播放弹窗（对齐原项目 showVideoPlayer，使用 VideoPlayer 组件） ===== */}
      {showVideoPlayer ? (
        <View className="fixed inset-0 z-[2000] flex items-center justify-center">
          <View
            className="absolute inset-0 bg-black/80"
            onClick={closeVideoPlayer}
          />
          <View className="relative w-[90%] rounded-lg overflow-hidden">
            <VideoPlayer
              src={currentVideoUrl}
              controls
              onError={closeVideoPlayer}
            />
            <View
              className="absolute top-0 right-0 w-[60rpx] h-[60rpx] flex items-center justify-center z-10"
              onClick={closeVideoPlayer}
            >
              <Text className="text-white text-[40rpx] font-bold">×</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* ===== 分享弹窗 ===== */}
      {showSharePopup ? (
        <View className="share-popup-mask" onClick={closeSharePopup}>
          <View className="share-popup-content" onClick={(e) => e.stopPropagation()}>
            {/* 关闭按钮 */}
            <View className="share-popup-close" onClick={closeSharePopup}>
              <Text className="text-white text-[28rpx]">×</Text>
            </View>
            {/* 分享卡片预览 */}
            <View className="share-popup-image">
              <Text className="share-popup-title">{tf('user.share.cardTitle', 'AI IHUI 智能平台')}</Text>
              <Text className="share-popup-subtitle">
                {tf('user.share.cardDesc', '开启智能学习之旅，探索无限可能')}
              </Text>
            </View>
            {/* 分享提示 */}
            <Text className="block text-center text-[28rpx] text-foreground font-semibold mb-[20rpx]">
              {tf('user.share.shareTo', '分享给好友')}
            </Text>
            {/* 分享按钮 */}
            <View
              className="share-popup-btn"
              onClick={() => {
                Taro.showToast({
                  title: tf('user.share.saveHint', '请截图保存后分享'),
                  icon: 'none',
                })
                closeSharePopup()
              }}
            >
              {tf('share.shareNow', '立即分享')}
            </View>
          </View>
        </View>
      ) : null}

    </View>
  )
}