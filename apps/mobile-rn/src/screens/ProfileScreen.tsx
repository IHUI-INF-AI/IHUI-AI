import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { ProfileScreen as SharedProfileScreen } from '@ihui/rn-app'
import type { SharedMenuSection } from '@ihui/rn-app'
import { getOrders, getUserStatistics, type UserStatistics } from '@ihui/api-client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { LoginPopUp } from '../components/LoginPopUp'
import StudyBar from '../components/StudyBar'
import type { StudyBarItem } from '../components/StudyBar'
import { VideoPlayer } from '../components/VideoPlayer'
import Empty from '../components/common/Empty'
import UserInfoCard from '../components/UserInfoCard'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import type { ProfileStackParamList } from '../navigation/RootNavigator'
import { MENU_SECTIONS, type MenuItem } from './profileMenuData'
import {
  EMPTY_AUDIO_LIST,
  EMPTY_IMAGE_LIST,
  EMPTY_TEXT_LIST,
  EMPTY_VIDEO_LIST,
  PROFILE_TAB_LIST,
  createInitialPagination,
  loadContentByTab,
  type AudioContent,
  type ContentPagination,
  type ImageContent,
  type ProfileTabId,
  type TextContent,
  type VideoContent,
} from './profileContentTypes'

type ProfileStackNav = NativeStackNavigationProp<ProfileStackParamList>

/**
 * RN 端 Profile 包装器 — 注入 t + 真实 API 数据(user/stats/orderCount)+ 导航回调,
 * 渲染共享 ProfileScreen。menuSections 从本地 profileMenuData 映射为共享契约格式。
 *
 * 4 Tab 内容区(文本/图片/视频/音频)1:1 复刻历史 Uniapp user/index.vue(行 59-191),
 * 渲染在 SharedProfileScreen 之后(外层 ScrollView 包裹,保证 4 Tab Section 可滚动)。
 */
export function ProfileScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<ProfileStackNav>()
  const { user, logout, ready } = useAuth()
  const { resolvedTheme } = useTheme()
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [orderCount, setOrderCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loginPromptVisible, setLoginPromptVisible] = useState(false)
  const [agreeChecked, setAgreeChecked] = useState(false)
  // FloatBox 悬浮提示(对齐 Uniapp user/index.vue 行 8 <FloatBox />)
  const [floatVisible, setFloatVisible] = useState(false)
  const [floatMessage, setFloatMessage] = useState('')
  const [floatType, setFloatType] = useState<FloatBoxType>('info')

  // 已登录但用户资料未就绪(常见于 token 过期 / 强制下线后清缓存)→ 引导重新登录
  useEffect(() => {
    if (ready && !user) {
      setLoginPromptVisible(true)
    }
  }, [ready, user])

  const navigateToLogin = () => {
    setLoginPromptVisible(false)
    navigation.getParent()?.navigate('Login' as never)
  }

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [statsRes, orderRes] = await Promise.all([
        getUserStatistics(),
        getOrders({ page: 1, pageSize: 1 }),
      ])
      if (cancelled) return
      if (statsRes.success) setStats(statsRes.data)
      if (orderRes.success) setOrderCount(orderRes.data.total)
      if (!statsRes.success && !orderRes.success) {
        setError(statsRes.error || orderRes.error || t('error.network'))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, t])

  const onNavigate = (item: MenuItem) => {
    if (item.viaParent) {
      // as string: react-navigation 的 navigate 是 distributive conditional type,
      // getParent() 返回的跨栈 navigator 无法接受 RootRoute 联合字面量,只能收窄为 string
      navigation.getParent()?.navigate(item.key as string)
    } else {
      navigation.navigate(item.key)
    }
  }

  /** FloatBox 悬浮提示触发器(对齐 Uniapp user/index.vue 行 8 <FloatBox />) */
  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatMessage(message)
    setFloatType(type)
    setFloatVisible(true)
  }, [])

  // 加载失败时弹出 FloatBox 提示(对齐 Uniapp 加载失败 toast)
  useEffect(() => {
    if (error) {
      showFloat(error, 'warning')
    }
  }, [error, showFloat])

  /** UserInfoCard 编辑资料 → ProfileEdit(对齐 Uniapp 修改资料) */
  const handleEditProfile = useCallback(() => {
    navigation.navigate('ProfileEdit')
  }, [navigation])

  /** UserInfoCard 充值 → Recharge(对齐 Uniapp 充值跳转) */
  const handleRecharge = useCallback(() => {
    navigation.getParent()?.navigate('Recharge' as never)
  }, [navigation])

  const menuSections: SharedMenuSection[] = MENU_SECTIONS.map((section) => ({
    title: t(section.titleKey),
    items: section.items.map((m) => ({
      key: m.key,
      label: t(m.labelKey),
      icon: m.icon,
    })),
  }))

  return (
    <>
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* UserInfoCard:VIP 徽章 + 智汇值 + 充值入口(对齐 Uniapp user/index.vue <UserInfoCard />) */}
        <UserInfoCard
          userInfo={
            user
              ? {
                  uuid: user.id,
                  username: user.nickname || user.username,
                  avatarUrl: user.avatar,
                  isVip: user.isVip,
                  identityType: user.roleId,
                  tokenQuantity: stats?.points ?? 0,
                }
              : {}
          }
          variant="new"
          showRechargeBtn
          onEdit={handleEditProfile}
          onRecharge={handleRecharge}
          onLogin={navigateToLogin}
        />
        <SharedProfileScreen
          t={t}
          user={
            user
              ? {
                  id: user.id,
                  nickname: user.nickname,
                  avatar: user.avatar ?? null,
                  email: user.email,
                  phone: user.phone,
                }
              : null
          }
          stats={stats}
          orderCount={orderCount}
          loading={loading}
          error={error}
          colorScheme={resolvedTheme}
          menuSections={menuSections}
          onNavigate={(key) => {
            const item = MENU_SECTIONS.flatMap((s) => s.items).find((m) => m.key === key)
            if (item) onNavigate(item)
          }}
          onLogout={() => void logout()}
          onBack={() => navigation.goBack()}
        />
        <ProfileContentSection />
      </ScrollView>
      <LoginPopUp
        visible={loginPromptVisible}
        title="登录已过期"
        description="登录状态已失效,请重新登录以继续使用"
        primaryLabel="立即登录"
        onPrimary={navigateToLogin}
        secondaryLabel="稍后再说"
        onSecondary={() => setLoginPromptVisible(false)}
        onClose={() => setLoginPromptVisible(false)}
        agreeChecked={agreeChecked}
        onAgreeChange={setAgreeChecked}
      />
      {/* FloatBox 悬浮提示(对齐 Uniapp user/index.vue 行 8 <FloatBox />) */}
      <FloatBox
        visible={floatVisible}
        type={floatType}
        message={floatMessage}
        onHide={() => setFloatVisible(false)}
      />
    </>
  )
}

// ============ 4 Tab 内容区(对齐 Uniapp 行 59-191) ============

const TAB_BAR_ITEMS: StudyBarItem[] = PROFILE_TAB_LIST.map((tab) => ({
  key: String(tab.id),
  label: tab.name,
}))

interface PreviewState {
  readonly images: readonly string[]
  readonly index: number
  readonly visible: boolean
}

interface VideoModalState {
  readonly url: string
  readonly visible: boolean
}

/**
 * 4 Tab 内容区 — StudyBar 切换 + 4 个 Tab 内容(文本/图片/视频/音频)+ 媒体预览。
 * 数据为空数组占位(数据加载是后续任务),loadContentByTab 空实现保留签名。
 */
function ProfileContentSection(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ProfileTabId>(1)
  const [textContentList] = useState<readonly TextContent[]>(EMPTY_TEXT_LIST)
  const [imageContentList] = useState<readonly ImageContent[]>(EMPTY_IMAGE_LIST)
  const [videoContentList] = useState<readonly VideoContent[]>(EMPTY_VIDEO_LIST)
  const [audioContentList] = useState<readonly AudioContent[]>(EMPTY_AUDIO_LIST)
  const [textPagination] = useState<ContentPagination>(createInitialPagination)
  const [imagePagination] = useState<ContentPagination>(createInitialPagination)
  const [videoPagination] = useState<ContentPagination>(createInitialPagination)
  const [audioPagination] = useState<ContentPagination>(createInitialPagination)
  const [preview, setPreview] = useState<PreviewState>({ images: [], index: 0, visible: false })
  const [videoModal, setVideoModal] = useState<VideoModalState>({ url: '', visible: false })

  const onTabChange = useCallback((key: string) => {
    const tabId = Number(key) as ProfileTabId
    if (tabId >= 1 && tabId <= 4) {
      setActiveTab(tabId)
      loadContentByTab(tabId)
    }
  }, [])

  const onImagePreview = useCallback((images: readonly string[], index: number) => {
    setPreview({ images, index, visible: true })
  }, [])

  const onVideoPlay = useCallback((url: string) => {
    if (!url) {
      Alert.alert('提示', '视频地址无效')
      return
    }
    setVideoModal({ url, visible: true })
  }, [])

  const closePreview = useCallback(() => {
    setPreview((prev) => ({ ...prev, visible: false }))
  }, [])

  const closeVideoModal = useCallback(() => {
    setVideoModal({ url: '', visible: false })
  }, [])

  return (
    <View style={styles.contentSection}>
      <View style={styles.tabBarWrap}>
        <StudyBar items={TAB_BAR_ITEMS} activeKey={String(activeTab)} onChange={onTabChange} />
      </View>
      <View style={styles.contentDisplayArea}>
        {activeTab === 1 ? (
          <TextTabContent list={textContentList} pagination={textPagination} />
        ) : null}
        {activeTab === 2 ? (
          <ImageTabContent
            list={imageContentList}
            pagination={imagePagination}
            onPreview={onImagePreview}
          />
        ) : null}
        {activeTab === 3 ? (
          <VideoTabContent
            list={videoContentList}
            pagination={videoPagination}
            onPlay={onVideoPlay}
          />
        ) : null}
        {activeTab === 4 ? (
          <AudioTabContent list={audioContentList} pagination={audioPagination} />
        ) : null}
      </View>
      <ImagePreviewModal
        images={preview.images}
        index={preview.index}
        visible={preview.visible}
        onClose={closePreview}
      />
      <VideoPlayerModal url={videoModal.url} visible={videoModal.visible} onClose={closeVideoModal} />
    </View>
  )
}

// ============ 文本 Tab(对齐 Uniapp 行 67-84) ============

interface TextTabProps {
  list: readonly TextContent[]
  pagination: ContentPagination
}

function TextTabContent({ list }: TextTabProps): React.JSX.Element {
  if (list.length === 0) {
    return <Empty text="暂无文本内容" icon="📝" />
  }
  return (
    <FlatList
      data={list}
      scrollEnabled={false}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      renderItem={({ item }) => (
        <View style={styles.contentItem}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle} numberOfLines={1}>
              {item.title || '文本内容'}
            </Text>
            <Text style={styles.contentTime}>{item.time}</Text>
          </View>
          <View style={styles.contentBody}>
            <Text style={styles.textContent}>{item.content}</Text>
          </View>
        </View>
      )}
    />
  )
}

// ============ 图片 Tab(对齐 Uniapp 行 87-111) ============

interface ImageTabProps {
  list: readonly ImageContent[]
  pagination: ContentPagination
  onPreview: (images: readonly string[], index: number) => void
}

function ImageTabContent({ list, onPreview }: ImageTabProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions()
  // 图片网格:3 列,间距 8,容器 padding 16 → 每格 = (screenWidth - 32 - 16) / 3
  const gridSize = Math.floor((screenWidth - 32 - 16) / 3)

  if (list.length === 0) {
    return <Empty text="暂无图片内容" icon="🖼️" />
  }
  return (
    <FlatList
      data={list}
      scrollEnabled={false}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      renderItem={({ item }) => (
        <View style={styles.contentItem}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentTitle} numberOfLines={1}>
              {item.title || '图片内容'}
            </Text>
            <Text style={styles.contentTime}>{item.time}</Text>
          </View>
          <View style={[styles.contentBody, styles.imageGrid]}>
            {item.imageList.map((url, idx) => (
              <TouchableOpacity
                key={`${url}-${idx}`}
                activeOpacity={0.85}
                onPress={() => onPreview(item.imageList, idx)}
                style={styles.imageGridItem}
              >
                <Image
                  source={{ uri: url }}
                  style={{ width: gridSize, height: gridSize, borderRadius: 8 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    />
  )
}

// ============ 视频 Tab(对齐 Uniapp 行 114-144) ============

interface VideoTabProps {
  list: readonly VideoContent[]
  pagination: ContentPagination
  onPlay: (url: string) => void
}

function VideoTabContent({ list, onPlay }: VideoTabProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions()
  // 视频封面宽度 = screenWidth - 32(容器 padding),高度默认 200(对齐 Uniapp 400rpx ≈ 200)
  const posterWidth = screenWidth - 32
  const posterHeight = 200

  if (list.length === 0) {
    return <Empty text="暂无视频内容" icon="🎬" />
  }
  return (
    <FlatList
      data={list}
      scrollEnabled={false}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      renderItem={({ item }) => {
        const posterUrl = getVideoPoster(item)
        const w = item.width ?? posterWidth
        const h = item.height ?? posterHeight
        return (
          <View style={styles.contentItem}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle} numberOfLines={1}>
                {item.title || '视频内容'}
              </Text>
              <Text style={styles.contentTime}>{item.time}</Text>
            </View>
            <View style={styles.contentBody}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onPlay(item.videoUrl)}
                style={styles.videoPosterContainer}
              >
                {posterUrl ? (
                  <Image
                    source={{ uri: posterUrl }}
                    style={{ width: w, height: h, borderRadius: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.videoPosterPlaceholder, { width: w, height: h }]} />
                )}
                <View style={styles.videoPlayIcon}>
                  <Text style={styles.videoPlayIconText}>▶</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )
      }}
    />
  )
}

// ============ 音频 Tab(对齐 Uniapp 行 147-189) ============

interface AudioTabProps {
  list: readonly AudioContent[]
  pagination: ContentPagination
}

function AudioTabContent({ list }: AudioTabProps): React.JSX.Element {
  if (list.length === 0) {
    return <Empty text="暂无音频内容" icon="🎵" />
  }
  return (
    <FlatList
      data={list}
      scrollEnabled={false}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.itemGap} />}
      renderItem={({ item }) => <AudioItem item={item} />}
    />
  )
}

/** 单条音频项 — 用 expo-audio useAudioPlayer 播放(对齐 Uniapp toggleAudioPlay 行 1180-1220) */
function AudioItem({ item }: { item: AudioContent }): React.JSX.Element {
  const player = useAudioPlayer(item.audioUrl)
  const status = useAudioPlayerStatus(player)
  const [barWidth, setBarWidth] = useState(0)

  const togglePlay = useCallback(() => {
    if (status.playing) {
      player.pause()
    } else {
      player.play()
    }
  }, [player, status.playing])

  const onProgressBarTap = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!barWidth || status.duration <= 0) return
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth))
      const target = ratio * status.duration
      void player.seekTo(target)
    },
    [barWidth, player, status.duration],
  )

  const onDownload = useCallback(() => {
    if (!item.audioUrl) {
      Alert.alert('提示', '音频地址无效')
      return
    }
    // RN 端下载需 expo-file-system + Sharing(后续任务接入),此处占位提示
    Alert.alert('提示', '音频下载功能开发中')
  }, [item.audioUrl])

  const progressRatio = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0

  return (
    <View style={styles.contentItem}>
      <View style={styles.contentHeader}>
        <Text style={styles.contentTitle} numberOfLines={1}>
          {item.title || '音频内容'}
        </Text>
        <Text style={styles.contentTime}>{item.time}</Text>
      </View>
      <View style={styles.contentBody}>
        <View style={styles.audioPlayer}>
          <TouchableOpacity
            onPress={togglePlay}
            style={styles.audioPlayBtn}
            activeOpacity={0.7}
            accessibilityLabel={status.playing ? '暂停' : '播放'}
          >
            <Text style={styles.audioPlayIcon}>{status.playing ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <Pressable
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            onPress={onProgressBarTap}
            style={styles.audioProgressTrack}
            accessibilityLabel="音频进度条"
          >
            <View
              style={[styles.audioProgressFill, { width: `${Math.round(progressRatio * 100)}%` }]}
            />
          </Pressable>
          <Text style={styles.audioTime}>{formatAudioTime(status.currentTime)}</Text>
          <TouchableOpacity
            onPress={onDownload}
            style={styles.audioDownloadBtn}
            activeOpacity={0.7}
            accessibilityLabel="下载音频"
          >
            <Text style={styles.audioDownloadIcon}>⬇</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

// ============ 图片预览 Modal(对齐 Uniapp previewImage → uni.previewImage) ============

interface ImagePreviewModalProps {
  images: readonly string[]
  index: number
  visible: boolean
  onClose: () => void
}

function ImagePreviewModal({
  images,
  index,
  visible,
  onClose,
}: ImagePreviewModalProps): React.JSX.Element {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewOverlay}>
        <TouchableOpacity onPress={onClose} style={styles.previewCloseBtn} activeOpacity={0.7}>
          <Text style={styles.previewCloseText}>×</Text>
        </TouchableOpacity>
        {images.length > 0 ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(index, images.length - 1)}
            getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
            keyExtractor={(url, i) => `${url}-${i}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.previewListContent}
            renderItem={({ item }) => (
              <View style={[styles.previewItem, { width: screenWidth, height: screenHeight }]}>
                <Image
                  source={{ uri: item }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            )}
          />
        ) : null}
      </View>
    </Modal>
  )
}

// ============ 视频播放 Modal(对齐 Uniapp openVideoPlayer 行 1336-1353) ============

interface VideoPlayerModalProps {
  url: string
  visible: boolean
  onClose: () => void
}

function VideoPlayerModal({ url, visible, onClose }: VideoPlayerModalProps): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions()
  // 视频容器宽度 = screenWidth - 32,高度按 16:9
  const videoWidth = screenWidth - 32
  const videoHeight = Math.round((videoWidth * 9) / 16)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoModalOverlay}>
        <View style={styles.videoModalContent}>
          <View style={{ width: videoWidth, height: videoHeight, borderRadius: 8, overflow: 'hidden' }}>
            {url ? <VideoPlayer url={url} /> : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.videoModalClose} activeOpacity={0.7}>
            <Text style={styles.videoModalCloseText}>×</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ============ 辅助函数(对齐 Uniapp formatAudioTime / getVideoPoster) ============

/** 格式化音频时间(对齐 Uniapp formatAudioTime 行 1243-1247) */
function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes}:${remainingSeconds < 10 ? '0' + remainingSeconds : remainingSeconds}`
}

/** 获取视频封面(对齐 Uniapp getVideoPoster 行 1355+) */
function getVideoPoster(item: VideoContent): string {
  if (item.posterUrl) return item.posterUrl
  // 后续可加 OSS 首帧图生成逻辑(对齐 Uniapp aliyuncs.com 检测)
  return item.videoUrl || ''
}

// ============ StyleSheet(浅色优雅风,圆角仅 12/8/6,无分割线,无蓝色发光) ============

const styles = StyleSheet.create({
  screenScroll: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  screenScrollContent: {
    flexGrow: 1,
  },
  contentSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabBarWrap: {
    marginBottom: 8,
  },
  contentDisplayArea: {
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
    padding: 12,
  },
  listContent: {
    gap: 0,
  },
  itemGap: {
    height: 12,
  },
  contentItem: {
    borderRadius: 8,
    backgroundColor: tokens.surface.light,
    padding: 12,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  contentTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  contentTime: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  contentBody: {
    gap: 8,
  },
  textContent: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.text.secondary,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageGridItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoPosterContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoPosterPlaceholder: {
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
  },
  videoPlayIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayIconText: {
    fontSize: 24,
    color: '#ffffff',
    marginLeft: 4,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayIcon: {
    fontSize: 16,
    color: tokens.surface.light,
    marginLeft: 2,
  },
  audioProgressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 6,
    backgroundColor: tokens.border.light,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  audioProgressFill: {
    height: 6,
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  },
  audioTime: {
    fontSize: 12,
    color: tokens.text.tertiary,
    minWidth: 38,
    textAlign: 'right',
  },
  audioDownloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDownloadIcon: {
    fontSize: 16,
    color: tokens.text.secondary,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseText: {
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 24,
  },
  previewListContent: {
    alignItems: 'center',
  },
  previewItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  videoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalContent: {
    alignItems: 'center',
    gap: 16,
  },
  videoModalClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoModalCloseText: {
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 24,
  },
})
