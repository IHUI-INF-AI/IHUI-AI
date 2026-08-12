import { View, Text, Image, Slider, Video } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useMemo, useCallback, useRef } from 'react'
import { isLoggedIn, getUserInfo, clearAuth, type UserInfo } from '@/utils/auth'
import { logout } from '@/api'
import { useI18n } from '@/i18n'
import { icon } from '@/constants/remote-icons'
import NavBar from '@/components/NavBar'
import DrawerComponent from '@/components/DrawerComponent'
import UserInfoCard from '@/components/UserInfoCard'
import LoginPopUp from '@/components/LoginPopUp'
import { rpx } from '@/utils/rpx'
// 本地化远程 CDN 图标（原 cdn.bspapp.com / file.aizhs.top 在 H5 模式下加载失败）
import aiIconLocal from '@/assets/remote-images/ai-icon.svg'
import courseIconLocal from '@/assets/remote-images/course-icon.svg'
import vipActIconLocal from '@/assets/remote-images/user-vip-act.svg'
import dingdanIcon from '@/assets/remote/images/dingdan.jpg'
import gerenIcon from '@/assets/remote/images/geren-icon.png'
import shezhiIcon from '@/assets/remote/images/shezhi.png'
import gonggaoIcon from '@/assets/remote/images/gonggao.png'
import xianLabelIcon from '@/assets/remote/images/xian_label.png'
import playIcon from '@/assets/remote/images/play.svg'
import pauseIcon from '@/assets/remote/images/pause.svg'
import downloadIcon from '@/assets/remote/images/download.png'
import yejiaoIcon from '@/assets/remote/images/yejiao.png'
import './index.css'

const defaultAvatar =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

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

// 会员权益项:i18n key 不存在时用中文 fallback(后续补 key 后自动切换)
const membershipBenefits: ReadonlyArray<{ icon: string; key: string; fallback: string }> = [
  { icon: aiIconLocal, key: 'user.benefits.exclusiveModel', fallback: '专属模型' },
  { icon: icon('zuan'), key: 'user.benefits.pointsBoost', fallback: '积分加倍' },
  { icon: icon('addKf'), key: 'user.benefits.prioritySupport', fallback: '优先客服' },
  { icon: vipActIconLocal, key: 'user.benefits.vipZone', fallback: '会员专区' },
  { icon: xianLabelIcon, key: 'user.benefits.discount', fallback: '折扣优惠' },
  { icon: icon('act'), key: 'user.benefits.exclusiveEvents', fallback: '专属活动' },
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
  const [activeTab, setActiveTab] = useState<number>(1)
  const [textContentList] = useState<Array<{title: string; time: string; content: string}>>([])
  const [imageContentList] = useState<Array<{title: string; time: string; imageList: string[]}>>([])
  const [videoContentList] = useState<Array<{title: string; time: string; videoUrl: string}>>([])
  const [audioContentList] = useState<Array<{title: string; time: string; audioUrl: string}>>([])
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
  // 分享弹窗
  const [showSharePopup, setShowSharePopup] = useState<boolean>(false)

  const isLogin = useMemo(() => !!userInfo, [userInfo])

  const refresh = useCallback(() => {
    setUserInfo(isLoggedIn() ? getUserInfo() : null)
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
            await logout()
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

  // 会员权益点击跳转
  const goVipDetail = useCallback(() => {
    Taro.navigateTo({ url: '/pages/vip/index' })
  }, [])

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
      {/* ===== 导航栏 ===== */}
      <NavBar
        variant="ai-home"
        title={tf('user.title', '我的')}
        bgColor="transparent"
        textColor="#fff"
        onMenuClick={toggleDrawer}
      />

      {/* ===== 用户信息头部 ===== */}
      <View
        className="pt-[120rpx] px-[32rpx] pb-[48rpx]"
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
        onNicknameChange={(nickname) => {
          // 更新本地昵称（实际保存由 profile 页面处理）
          if (userInfo) {
            setUserInfo({ ...userInfo, nickname })
          }
        }}
      />

      {/* ===== 会员权益卡片 ===== */}
      <View
        className="mx-[32rpx] mt-[24rpx] mb-0 bg-card border border-border rounded-lg overflow-hidden"
        onClick={goVipDetail}
      >
        <View className="flex items-center justify-between px-[32rpx] py-[28rpx]">
          <Text className="text-[28rpx] font-semibold text-foreground">
            {tf('user.benefits.title', '会员权益')}
          </Text>
          <View className="flex items-center gap-[12rpx]">
            <Text
              className="text-[24rpx] text-primary"
              onClick={(e) => {
                e.stopPropagation()
                toggleBenefits()
              }}
            >
              {showBenefits ? tf('common.collapse', '收起') : tf('common.expand', '展开')}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground">›</Text>
          </View>
        </View>
        {showBenefits ? (
          <View className="flex flex-wrap px-[8rpx] pb-[16rpx]">
            {membershipBenefits.map((b) => (
              <View key={b.key} className="w-1/3 flex flex-col items-center py-[16rpx]">
                {renderIcon(b.icon, 'text-[44rpx]', 'w-[44rpx] h-[44rpx]')}
                <Text className="mt-[8rpx] text-[24rpx] text-foreground text-center">
                  {tf(b.key, b.fallback)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ===== StudyBar + 内容展示区 ===== */}
      <View style={{ padding: '0 20rpx', marginTop: '20rpx', marginBottom: '20rpx' }}>
        {/* StudyBar Tab 切换 */}
        <View
          className="flex flex-row"
          style={{
            borderBottom: '2rpx solid rgba(255,255,255,0.1)',
            marginBottom: '16rpx',
          }}
        >
          {[
            { key: 1, label: tf('user.tab.text', '文本') },
            { key: 2, label: tf('user.tab.image', '图片') },
            { key: 3, label: tf('user.tab.video', '视频') },
            { key: 4, label: tf('user.tab.audio', '音频') },
          ].map((tab) => (
            <View
              key={tab.key}
              className="flex-1 py-[16rpx] text-center"
              style={{
                borderBottom: activeTab === tab.key ? '4rpx solid var(--color-primary)' : '4rpx solid transparent',
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text
                style={{
                  fontSize: rpx(28),
                  color: activeTab === tab.key ? 'var(--color-primary)' : 'var(--color-muted-foreground, #888)',
                  fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                }}
              >
                {tab.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 内容展示区 */}
        <View>
          {/* 文本内容 */}
          {activeTab === 1 && (
            <View>
              {textContentList.length === 0 ? (
                <View className="py-[60rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.text', '暂无文本内容')}
                  </Text>
                </View>
              ) : (
                textContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[24rpx]">
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
                <View className="py-[60rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.image', '暂无图片内容')}
                  </Text>
                </View>
              ) : (
                imageContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[24rpx]">
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
                <View className="py-[60rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.video', '暂无视频内容')}
                  </Text>
                </View>
              ) : (
                videoContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg overflow-hidden">
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
                <View className="py-[60rpx] flex items-center justify-center">
                  <Text style={{ fontSize: rpx(26), color: 'var(--color-muted-foreground, #999)' }}>
                    {tf('user.empty.audio', '暂无音频内容')}
                  </Text>
                </View>
              ) : (
                audioContentList.map((item, index) => (
                  <View key={index} className="mb-[20rpx] bg-card rounded-lg p-[24rpx]">
                    <View className="flex-row items-center justify-between mb-[12rpx]">
                      <Text className="text-[28rpx] font-semibold text-foreground">{item.title}</Text>
                      <Text className="text-[22rpx] text-muted-foreground">{item.time}</Text>
                    </View>
                    <View className="flex-row items-center gap-[12rpx]">
                      {/* 播放/暂停按钮 */}
                      <View
                        className="w-[72rpx] h-[72rpx] rounded-full flex items-center justify-center"
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
      <View className="mx-[32rpx] my-[24rpx] py-[28rpx]">
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
      <View className="mx-[32rpx] my-[24rpx] overflow-hidden">
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
          className="mx-[32rpx] my-[48rpx] h-[96rpx] leading-[96rpx] text-center border border-primary text-primary rounded-lg text-[30rpx]"
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

      {/* ===== 视频播放弹窗 ===== */}
      {showVideoPlayer ? (
        <View className="fixed inset-0 z-[2000] flex items-center justify-center">
          <View
            className="absolute inset-0 bg-black/80"
            onClick={closeVideoPlayer}
          />
          <View className="relative w-[90%] rounded-lg overflow-hidden">
            <Video
              src={currentVideoUrl}
              controls
              autoplay={false}
              objectFit="contain"
              showCenterPlayBtn
              showFullscreenBtn
              enableProgressGesture
              style={{ width: '100%', height: rpx(500) }}
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

      {/* ===== DrawerComponent 侧边栏抽屉 ===== */}
      <DrawerComponent
        visible={showDrawer}
        onClose={toggleDrawer}
        side="left"
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
        onCreateChat={() => {
          toggleDrawer()
          Taro.switchTab({ url: '/pages/index/index' })
        }}
      />
    </View>
  )
}