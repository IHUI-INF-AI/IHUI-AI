import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import * as FileSystem from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { ProfileScreen as SharedProfileScreen } from '@ihui/rn-app'
import type { SharedMenuSection } from '@ihui/rn-app'
import type { UserInfo } from '@ihui/types'
import {
  deleteConversation,
  getOrders,
  getUserStatistics,
  listConversations,
  updateProfile,
  type AuthUser,
  type ConversationDetail,
  type UserStatistics,
} from '@ihui/api-client'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { LoginPopUp } from '../components/LoginPopUp'
import StudyBar from '../components/StudyBar'
import type { StudyBarItem } from '../components/StudyBar'
import { VideoPlayer } from '../components/VideoPlayer'
import Empty from '../components/common/Empty'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { UserCard, type UserCardKey } from '../components/UserCard'
import UserInfoCard from '../components/UserInfoCard'
import { UserMembershipBenefits, type BenefitItem, type MembershipLevel } from '../components/UserMembershipBenefits'
import { Bot, BookOpen, ChevronDown, Database } from 'lucide-react-native'
import Drawer, { type DrawerConversationItem, type DrawerExtraMenu, type DrawerTab } from '../components/Drawer'
import { NavBar } from '../components/NavBar'
import { ColorfulLoader } from '../components/ColorfulLoader'
import type { MainStackParamList, RootStackParamList } from '../navigation/RootNavigator'
import { mainScreenForTab, type MainTabKey } from '../navigation/RootNavigator'
import { MENU_SECTIONS, type MenuItem } from './profileMenuData'
import {
  EMPTY_AUDIO_LIST,
  EMPTY_IMAGE_LIST,
  EMPTY_TEXT_LIST,
  EMPTY_VIDEO_LIST,
  PROFILE_TAB_LIST,
  createInitialPagination,
  extractConversationMetadata,
  type AudioContent,
  type ContentPagination,
  type ImageContent,
  type ProfileTabId,
  type TextContent,
  type VideoContent,
} from './profileContentTypes'

type ProfileStackNav = NativeStackNavigationProp<MainStackParamList, 'ProfileMain'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

/** 会员权益 3 项(对齐 Uniapp memberBenefitsData 行 297-310) */
const MEMBERSHIP_BENEFITS: readonly BenefitItem[] = [
  { id: 'ai-free', icon: Bot, title: 'AI助手免费次数增加', desc: '每日赠送免费对话次数' },
  { id: 'course-free', icon: BookOpen, title: '部分课程免费学习', desc: '专享 VIP 课程资源' },
  { id: 'knowledge-base', icon: Database, title: '建立专属知识库', desc: '私有知识库存储与管理' },
]

/**
 * 跨栈导航 helper — React Navigation v6 的 navigate 重载对 178+ 路由的 RootStackParamList
 * 联合类型推断失败(distributive conditional type 限制),需在 helper 内部隔离类型断言。
 * FIXME(any): react-navigation v6 类型系统限制;移除计划:升级到 v7 后改用原生 navigate
 */
function navigateRoot(nav: RootNav | undefined, route: keyof RootStackParamList): void {
  if (nav) {
    nav.navigate(route as never)
  }
}

/** Drawer 5 主菜单 → RN Tab 路由映射(square/share 由 handleDrawerNavigate 特殊跳转到 RootStack 独立页,不走此映射) */
const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain',
  share: 'HomeMain',
  mine: 'ProfileMain',
}

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
  const rootNav = navigation.getParent<RootNav>()
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
  // Drawer 侧滑抽屉(对齐 Uniapp user/index.vue DrawerComponentall)
  const [drawerVisible, setDrawerVisible] = useState(false)
  // Drawer 历史对话列表(对齐 Uniapp loadHistoryChat → getModelChat API + groupDataByDate)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)
  // 弹窗态(对齐 Uniapp user/index.vue 弹层模式,替代跳转页面 + 系统 Alert):
  // - editProfileVisible:编辑资料弹窗(替代 navigation.navigate('ProfileEdit'))
  // - levelIntroVisible:等级介绍弹窗(对齐 Uniapp level-intro 3 级体系)
  // - unsubscribeVisible:退订确认弹窗(替代 Alert.alert 系统弹窗)
  const [editProfileVisible, setEditProfileVisible] = useState(false)
  const [levelIntroVisible, setLevelIntroVisible] = useState(false)
  const [unsubscribeVisible, setUnsubscribeVisible] = useState(false)
  // 会员权益折叠(对齐 Uniapp toggleMembershipBenefits,默认折叠)
  const [showMembershipBenefits, setShowMembershipBenefits] = useState(false)

  // 已登录但用户资料未就绪(常见于 token 过期 / 强制下线后清缓存)→ 引导重新登录
  useEffect(() => {
    if (ready && !user) {
      setLoginPromptVisible(true)
    }
  }, [ready, user])

  const navigateToLogin = () => {
    setLoginPromptVisible(false)
    rootNav?.navigate('Login')
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

  /**
   * 加载 Drawer 历史对话(对齐 Uniapp loadHistoryChat → getModelChat API + groupDataByDate)。
   * 懒加载:首次打开 Drawer 时拉取,后续复用缓存(下拉刷新可手动触发)。
   * Drawer 的 groupByModelAndDate 已在组件内实现,这里只需把 API 结果映射为 DrawerConversationItem[]。
   */
  const loadDrawerConversations = useCallback(async () => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      const items: DrawerConversationItem[] = res.data.conversations.map(mapConversationToDrawer)
      setDrawerConversations(items)
    } else {
      // 静默失败:不弹错误(对齐 Uniapp loadHistoryChat catch 后 setGroupedData([]))
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  // Drawer 首次打开时懒加载历史对话(对齐 Uniapp onShow + loadHistoryChat)
  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && user) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, user, loadDrawerConversations])

  const onNavigate = (item: MenuItem) => {
    if (item.viaParent) {
      navigateRoot(rootNav, item.key)
    } else {
      navigateRoot(rootNav, item.key)
    }
  }

  /** UserCard 4 宫格点击跳转(对齐 Uniapp user_cards.vue handleClick) */
  const handleUserCardPress = (key: UserCardKey) => {
    switch (key) {
      case 'order':
        rootNav?.navigate('Order')
        break
      case 'wallet':
        rootNav?.navigate('Wallet')
        break
      case 'company':
        navigateRoot(rootNav, 'Distribution')
        break
      case 'token':
        navigateRoot(rootNav, 'TokenValue')
        break
      default:
        // 未识别的宫格 key,静默忽略(防御性:防止 UserCardKey 类型漂移)
        break
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

  const menuSections: SharedMenuSection[] = MENU_SECTIONS.map((section) => ({
    title: t(section.titleKey),
    items: section.items.map((m) => ({
      key: m.key as string,
      label: t(m.labelKey),
      icon: m.icon,
    })),
  }))

  // ── Drawer 回调(对齐 Uniapp user/index.vue DrawerComponentall) ──
  const handleDrawerNavigate = (tab: DrawerTab) => {
    setDrawerVisible(false)
    // square/share 无对应 RN Tab,跳转独立 RootStack 页(对齐 Uniapp 广场页/资讯页)
    if (tab === 'square') {
      rootNav?.navigate('Square')
      return
    }
    if (tab === 'share') {
      rootNav?.navigate('Share')
      return
    }
    rootNav?.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }
  const handleDrawerNavigateCompany = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Distribution')
  }
  const handleDrawerClaimFree = () => {
    setDrawerVisible(false)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      showFloat('链接已复制', 'success')
    } catch {
      showFloat('复制失败,请重试', 'warning')
    }
  }
  const handleDrawerCreateNewChat = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'AiMain' })
  }
  // Uniapp 原项目跳 chat 传 12 参数(conversationId/title/modelName/agentId/type/source/系统消息/上下文/prompt/欢迎语/是否新会话/时间戳);
  // mobile-rn Chat 路由类型已扩展为 { conversationId, title, modelName, modelId, remark },
  // 这里补全 conversationId/title/modelName/modelId 对齐 Uniapp 关键字段;
  // remark 暂无 ConversationDetail 来源(后端未返回),留 undefined,后续接口扩展后补全。
  const handleDrawerSelectConversation = (id: string) => {
    setDrawerVisible(false)
    const conv = drawerConversations.find((c) => c.id === id)
    rootNav?.navigate('Chat', {
      conversationId: id,
      title: conv?.title,
      modelName: conv?.modelConfig?.name,
      modelId: conv?.modelConfig?.id,
    })
  }
  const handleDrawerDeleteConversation = (id: string) => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          // 乐观删除:先从本地列表移除,API 失败时回滚(对齐 Uniapp 删除对话体验)
          const snapshot = drawerConversations
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void (async () => {
            const res = await deleteConversation(id)
            if (!res.success) {
              // 回滚
              setDrawerConversations(snapshot)
              showFloat('删除失败,请重试', 'warning')
            } else {
              showFloat('已删除', 'success')
            }
          })()
        },
      },
    ])
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu) => {
    setDrawerVisible(false)
    switch (menu) {
      case 'aigc':
        navigateRoot(rootNav, 'AigcList')
        break
      case 'learn':
        navigateRoot(rootNav, 'Learn')
        break
      case 'modelPlaza':
        navigateRoot(rootNav, 'ModelPlaza')
        break
      case 'company':
      case 'tools':
        rootNav?.navigate('Settings')
        break
    }
  }
  const handleDrawerOpenSettings = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Settings')
  }
  const handleDrawerOpenMessages = () => {
    setDrawerVisible(false)
    rootNav?.navigate('MessageCenter')
  }
  const handleDrawerGoHome = () => {
    setDrawerVisible(false)
    rootNav?.navigate('Main', { screen: 'HomeMain' })
  }

  /** Drawer user 映射(AuthUser → Drawer user) */
  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: (user?.isVip ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  /**
   * AuthUser → UserInfo 映射(UserInfoCard 所需)。
   * AuthUser 无 tokenQuantity/growthValue/growthMax/vipExpireAt 字段,这些项省略
   * (UserInfo 全字段可选,UserInfoCard 内部 formatTokenValue(undefined)='0' 兜底)。
   * identityType API 未返回,默认 0(普通用户)。vipLevel 由 isVip 派生。
   */
  const userInfoForCard: UserInfo | null = user
    ? {
        uuid: user.id,
        username: user.nickname || user.username,
        avatarUrl: user.avatar,
        isVip: user.isVip ?? 0,
        identityType: 0,
        inviteCode: user.inviteCode,
        vipLevel: user.isVip === 1 ? 'VIP' : undefined,
      }
    : null

  return (
    <>
      <NavBar
        title={t('profile.title')}
        rightActions={[
          { icon: '✎', label: t('menu.feedback'), onPress: () => rootNav?.navigate('Feedback', { pageType: 'profile' } as never) },
          { icon: '☰', onPress: () => setDrawerVisible(true) },
        ]}
      />
      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loaderWrap}>
            <ColorfulLoader size={48} />
          </View>
        ) : (
          <>
            {userInfoForCard ? (
              <View style={styles.userInfoCardWrap}>
                <UserInfoCard
                  userInfo={userInfoForCard}
                  showRechargeBtn
                  onEdit={() => setEditProfileVisible(true)}
                  onRecharge={() => rootNav?.navigate('Wallet')}
                  onLogin={() => rootNav?.navigate('Login')}
                  onUnsubscribe={() => setUnsubscribeVisible(true)}
                  onLevelIntro={() => setLevelIntroVisible(true)}
                />
                {/* 等级介绍按钮(对齐 Uniapp level-intro popup,UserInfoCard 内部仅有简化等级 Modal,
                    此处为完整 3 级体系介绍入口) */}
                <TouchableOpacity
                  style={styles.levelIntroBtn}
                  activeOpacity={0.7}
                  onPress={() => setLevelIntroVisible(true)}
                  accessibilityLabel="等级介绍"
                >
                  <Text style={styles.levelIntroBtnText}>等级介绍</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <UserCard
              t={t}
              isLoggedIn={!!user}
              onPress={handleUserCardPress}
            />
            {/* 会员权益(对齐 Uniapp memberBenefitsData 3 项:AI助手免费次数/部分课程免费/专属知识库) */}
            {/* 折叠头(对齐 Uniapp user/index.vue 行 30 toggleMembershipBenefits + 行 35-39 back.svg 箭头) */}
            <TouchableOpacity
              style={styles.membershipHeader}
              onPress={() => setShowMembershipBenefits((v) => !v)}
              activeOpacity={0.7}
              accessibilityLabel="切换会员权益显示"
            >
              <Text style={styles.membershipHeaderText}>会员权益</Text>
              <View
                style={[
                  styles.membershipArrow,
                  showMembershipBenefits ? styles.membershipArrowExpanded : null,
                ]}
              >
                <ChevronDown size={24} color={tokens.text.secondary} />
              </View>
            </TouchableOpacity>
            {showMembershipBenefits ? (
              <View style={styles.membershipBenefitsWrap}>
                <UserMembershipBenefits
                  level={(user?.isVip === 1 ? 'vip' : 'normal') as MembershipLevel}
                  benefits={MEMBERSHIP_BENEFITS}
                  onPressUpgrade={() => setLevelIntroVisible(true)}
                />
              </View>
            ) : null}
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
              loading={false}
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
          </>
        )}
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
      {/* Drawer 侧滑抽屉(对齐 Uniapp user/index.vue DrawerComponentall) */}
      <Drawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        user={drawerUser}
        conversations={drawerConversations}
        onNavigate={handleDrawerNavigate}
        onNavigateCompany={handleDrawerNavigateCompany}
        onClaimFree={handleDrawerClaimFree}
        onCreateNewChat={handleDrawerCreateNewChat}
        onSelectConversation={handleDrawerSelectConversation}
        onDeleteConversation={handleDrawerDeleteConversation}
        onOpenSettings={handleDrawerOpenSettings}
        onOpenMessages={handleDrawerOpenMessages}
        onGoHome={handleDrawerGoHome}
        onNavigateExtra={handleNavigateExtra}
      />
      {/* 编辑资料弹窗(对齐 Uniapp user/index.vue 编辑资料弹层,替代 ProfileEdit 跳转) */}
      {user ? (
        <EditProfileModal
          visible={editProfileVisible}
          user={user}
          onClose={() => setEditProfileVisible(false)}
          onSaved={() => {
            setEditProfileVisible(false)
            showFloat('资料已保存', 'success')
          }}
        />
      ) : null}
      {/* 等级介绍弹窗(对齐 Uniapp level-intro popup,3 级体系) */}
      <LevelIntroModal
        visible={levelIntroVisible}
        onClose={() => setLevelIntroVisible(false)}
      />
      {/* 退订确认弹窗(对齐 Uniapp 退订确认弹层,替代 Alert.alert 系统弹窗) */}
      <UnsubscribeModal
        visible={unsubscribeVisible}
        onClose={() => setUnsubscribeVisible(false)}
        onConfirm={() => {
          setUnsubscribeVisible(false)
          showFloat('退订功能开发中', 'info')
        }}
      />
    </>
  )
}

// ============ 编辑资料 Modal(对齐 Uniapp user/index.vue 编辑资料弹层) ============

interface EditProfileModalProps {
  visible: boolean
  user: AuthUser
  onClose: () => void
  onSaved: () => void
}

/**
 * 编辑资料弹窗 — 头像(可点击更换,占位提示)+ 昵称输入框(可编辑)+
 * 邮箱输入框(只读)+ 手机号输入框(只读)+ 保存/取消按钮。
 * 替代 navigation.navigate('ProfileEdit') 跳转页面对齐 Uniapp 弹层交互。
 * 保存时调用 updateProfile API 持久化(对齐 Uniapp LoginPopUp bindUserNew)。
 */
function EditProfileModal({
  visible,
  user,
  onClose,
  onSaved,
}: EditProfileModalProps): React.JSX.Element {
  const [nickname, setNickname] = useState(user.nickname ?? user.username ?? '')
  const [avatarHintVisible, setAvatarHintVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // 每次打开弹窗时重置昵称为当前用户值,防止上次编辑残留
  useEffect(() => {
    if (visible) {
      setNickname(user.nickname ?? user.username ?? '')
      setAvatarHintVisible(false)
      setSaveError('')
    }
  }, [visible, user.nickname, user.username])

  const handleSave = async () => {
    const trimmed = nickname.trim()
    if (!trimmed) {
      setSaveError('昵称不能为空')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await updateProfile({ nickname: trimmed })
      if (!res.success) {
        setSaveError(res.error || '保存失败,请稍后重试')
        return
      }
      onSaved()
    } catch {
      setSaveError('网络错误,请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.editProfileOverlay}>
        <View style={styles.editProfileCard}>
          <Text style={styles.editProfileTitle}>编辑资料</Text>

          {/* 头像(可点击更换,占位提示) */}
          <View style={styles.editProfileAvatarSection}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setAvatarHintVisible(true)}
              style={styles.editProfileAvatarBtn}
              accessibilityLabel="更换头像"
            >
              <Image
                source={{ uri: user.avatar || DEFAULT_AVATAR_URL }}
                style={styles.editProfileAvatar}
              />
              <View style={styles.editProfileAvatarBadge}>
                <Text style={styles.editProfileAvatarBadgeText}>+</Text>
              </View>
            </TouchableOpacity>
            {avatarHintVisible ? (
              <Text style={styles.editProfileAvatarHint}>头像更换功能开发中</Text>
            ) : null}
          </View>

          {/* 昵称(可编辑) */}
          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>昵称</Text>
            <TextInput
              style={styles.editProfileInput}
              value={nickname}
              onChangeText={setNickname}
              placeholder="请输入昵称"
              placeholderTextColor={tokens.text.tertiary}
              maxLength={8}
            />
          </View>

          {/* 邮箱(只读) */}
          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>邮箱</Text>
            <TextInput
              style={[styles.editProfileInput, styles.editProfileInputReadOnly]}
              value={user.email ?? '未绑定'}
              editable={false}
              placeholderTextColor={tokens.text.tertiary}
            />
          </View>

          {/* 手机号(只读) */}
          <View style={styles.editProfileField}>
            <Text style={styles.editProfileLabel}>手机号</Text>
            <TextInput
              style={[styles.editProfileInput, styles.editProfileInputReadOnly]}
              value={user.phone ?? '未绑定'}
              editable={false}
              placeholderTextColor={tokens.text.tertiary}
            />
          </View>

          {/* 按钮 */}
          {saveError ? (
            <Text style={styles.editProfileError}>{saveError}</Text>
          ) : null}
          <View style={styles.editProfileBtnRow}>
            <TouchableOpacity
              style={styles.editProfileCancelBtn}
              activeOpacity={0.7}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.editProfileCancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editProfileSaveBtn, saving ? styles.editProfileSaveBtnDisabled : null]}
              activeOpacity={0.7}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.editProfileSaveBtnText}>
                {saving ? '保存中...' : '保存'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ============ 等级介绍 Modal(对齐 Uniapp level-intro popup,3 级体系) ============

interface LevelIntroModalProps {
  visible: boolean
  onClose: () => void
}

/** 等级体系 3 级(普通用户 / VIP / 操盘手),对齐 Uniapp level-intro 数据结构 */
const LEVEL_INTRO_DATA: readonly {
  readonly level: string
  readonly desc: string
  readonly benefits: readonly string[]
}[] = [
  {
    level: '普通用户',
    desc: '注册即享基础功能',
    benefits: ['AI 助手每日免费对话次数', '基础课程学习', '社区交流'],
  },
  {
    level: 'VIP 会员',
    desc: '付费升级,解锁进阶能力',
    benefits: [
      'AI 助手免费次数大幅增加',
      '部分课程免费学习',
      '建立专属知识库',
      '专属客服支持',
    ],
  },
  {
    level: '操盘手',
    desc: '顶级会员,享受平台全部权益',
    benefits: [
      '无限 AI 助手对话',
      '全部课程免费学习',
      '专属操盘策略工具',
      '1V1 专属顾问',
      '高级数据分析报表',
    ],
  },
]

/**
 * 等级介绍弹窗 — 3 级体系说明(普通用户 / VIP / 操盘手)+ 各等级权益列表 + 关闭按钮。
 * 对齐 Uniapp user/index.vue 等级介绍弹层,在 UserInfoCard 下方独立按钮触发。
 */
function LevelIntroModal({ visible, onClose }: LevelIntroModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.levelIntroOverlay}>
        <View style={styles.levelIntroCard}>
          <Text style={styles.levelIntroTitle}>等级介绍</Text>
          <ScrollView style={styles.levelIntroScroll} showsVerticalScrollIndicator={false}>
            {LEVEL_INTRO_DATA.map((item) => (
              <View key={item.level} style={styles.levelIntroItem}>
                <View style={styles.levelIntroItemHeader}>
                  <Text style={styles.levelIntroItemLevel}>{item.level}</Text>
                  <Text style={styles.levelIntroItemDesc}>{item.desc}</Text>
                </View>
                <View style={styles.levelIntroBenefitList}>
                  {item.benefits.map((b) => (
                    <Text key={b} style={styles.levelIntroBenefitItem}>
                      · {b}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.levelIntroCloseBtn}
            activeOpacity={0.7}
            onPress={onClose}
          >
            <Text style={styles.levelIntroCloseBtnText}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ============ 退订确认 Modal(对齐 Uniapp 退订确认弹层,替代 Alert.alert) ============

interface UnsubscribeModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: () => void
}

/**
 * 退订确认弹窗 — 警告图标 + 标题 + 退订说明 + 确认退订按钮(红色)+ 取消按钮。
 * 替代 Alert.alert 系统弹窗,对齐 Uniapp 退订确认弹层视觉。
 */
function UnsubscribeModal({
  visible,
  onClose,
  onConfirm,
}: UnsubscribeModalProps): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.unsubscribeOverlay}>
        <View style={styles.unsubscribeCard}>
          <View style={styles.unsubscribeIconWrap}>
            <Text style={styles.unsubscribeIcon}>⚠</Text>
          </View>
          <Text style={styles.unsubscribeTitle}>确认退订</Text>
          <Text style={styles.unsubscribeDesc}>
            退订后将无法享受会员权益,包括 AI 助手免费次数、专属课程、知识库等。退订操作不可撤销,请谨慎确认。
          </Text>
          <View style={styles.unsubscribeBtnRow}>
            <TouchableOpacity
              style={styles.unsubscribeCancelBtn}
              activeOpacity={0.7}
              onPress={onClose}
            >
              <Text style={styles.unsubscribeCancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unsubscribeConfirmBtn}
              activeOpacity={0.7}
              onPress={onConfirm}
            >
              <Text style={styles.unsubscribeConfirmBtnText}>确认退订</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
 * 调 listConversations API 按 metadata.contentType 过滤渲染(后端未返回 contentType 时,
 * 所有对话 fallback 到 text tab,其他 tab 显示空)。
 */
function ProfileContentSection(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<ProfileTabId>(1)
  const [textContentList, setTextContentList] = useState<readonly TextContent[]>(EMPTY_TEXT_LIST)
  const [imageContentList, setImageContentList] = useState<readonly ImageContent[]>(EMPTY_IMAGE_LIST)
  const [videoContentList, setVideoContentList] = useState<readonly VideoContent[]>(EMPTY_VIDEO_LIST)
  const [audioContentList, setAudioContentList] = useState<readonly AudioContent[]>(EMPTY_AUDIO_LIST)
  const [textPagination] = useState<ContentPagination>(createInitialPagination)
  const [imagePagination] = useState<ContentPagination>(createInitialPagination)
  const [videoPagination] = useState<ContentPagination>(createInitialPagination)
  const [audioPagination] = useState<ContentPagination>(createInitialPagination)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<PreviewState>({ images: [], index: 0, visible: false })
  const [videoModal, setVideoModal] = useState<VideoModalState>({ url: '', visible: false })

  /**
   * 按 Tab 加载内容(对齐 Uniapp loadContentByTab,接 listConversations API)。
   * 后端 ConversationDetail 没有 contentType 字段,通过 metadata.contentType 安全守卫提取;
   * 后端未返回时所有对话归入 text tab,image/video/audio tab 显示空。
   * 每次只更新当前 tab 对应的列表,避免覆盖其他 tab 的缓存。
   */
  const loadTabContent = useCallback(async (tab: ProfileTabId): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const res = await listConversations({ page: 1, pageSize: 20 })
      if (!res.success) {
        setError(res.error ?? '加载失败')
        if (tab === 1) setTextContentList([])
        else if (tab === 2) setImageContentList([])
        else if (tab === 3) setVideoContentList([])
        else setAudioContentList([])
        return
      }
      const all = res.data.conversations
      const textContents: TextContent[] = []
      const imageContents: ImageContent[] = []
      const videoContents: VideoContent[] = []
      const audioContents: AudioContent[] = []
      for (const conv of all) {
        const meta = extractConversationMetadata(conv)
        const tabType = meta.contentType ?? 'text'
        const time = conv.updatedAt ?? conv.createdAt
        const title = conv.title?.trim() || '未命名对话'
        if (tabType === 'image') {
          const list = meta.imageList ?? (meta.thumbnailUrl ? [meta.thumbnailUrl] : [])
          imageContents.push({
            id: conv.id,
            title,
            time,
            imageList: list,
          })
        } else if (tabType === 'video') {
          videoContents.push({
            id: conv.id,
            title,
            time,
            videoUrl: meta.videoUrl ?? '',
            posterUrl: meta.posterUrl,
            width: meta.width,
            height: meta.height,
          })
        } else if (tabType === 'audio') {
          audioContents.push({
            id: conv.id,
            title,
            time,
            audioUrl: meta.audioUrl ?? '',
          })
        } else {
          // text tab(含 contentType 缺失 fallback)
          textContents.push({
            id: conv.id,
            title,
            time,
            content: meta.lastMessage ?? '',
          })
        }
      }
      // 只更新当前 tab 的内容,保留其他 tab 缓存(切回时无需重新请求)
      if (tab === 1) setTextContentList(textContents)
      else if (tab === 2) setImageContentList(imageContents)
      else if (tab === 3) setVideoContentList(videoContents)
      else setAudioContentList(audioContents)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      if (tab === 1) setTextContentList([])
      else if (tab === 2) setImageContentList([])
      else if (tab === 3) setVideoContentList([])
      else setAudioContentList([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 切 Tab 触发加载(对齐 Uniapp onTabChange → loadContentByTab)
  useEffect(() => {
    void loadTabContent(activeTab)
  }, [activeTab, loadTabContent])

  const onTabChange = useCallback((key: string) => {
    const tabId = Number(key) as ProfileTabId
    if (tabId >= 1 && tabId <= 4) {
      setActiveTab(tabId)
    }
  }, [])

  const onRetry = useCallback(() => {
    void loadTabContent(activeTab)
  }, [activeTab, loadTabContent])

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

  /** 复制官网链接(对齐 Uniapp copyWebsiteLink 行 1315-1334 + yejiao.png 行 192-197 页面级页脚) */
  const onCopyLink = useCallback(() => {
    Clipboard.setString(WEBSITE_URL)
    Alert.alert('提示', '已复制官网链接')
  }, [])

  return (
    <View style={styles.contentSection}>
      <View style={styles.tabBarWrap}>
        <StudyBar items={TAB_BAR_ITEMS} activeKey={String(activeTab)} onChange={onTabChange} />
      </View>
      <View style={styles.contentDisplayArea}>
        {loading ? (
          <View style={styles.tabLoaderWrap}>
            <ColorfulLoader size={36} />
          </View>
        ) : error ? (
          <View style={styles.tabErrorWrap}>
            <Text style={styles.tabErrorText}>{error}</Text>
            <TouchableOpacity onPress={onRetry} style={styles.tabRetryBtn} activeOpacity={0.7}>
              <Text style={styles.tabRetryText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
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
          </>
        )}
      </View>
      {/* 官网链接(页面级页脚,对齐 Uniapp yejiao.png 行 192-197,在所有 Tab 内容之外跨 Tab 可见) */}
      <TouchableOpacity
        onPress={onCopyLink}
        style={styles.copyLinkBtn}
        activeOpacity={0.7}
        accessibilityLabel="复制官网链接"
      >
        <Text style={styles.copyLinkText}>复制官网链接</Text>
      </TouchableOpacity>
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
    <View>
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
    </View>
  )
}

// ============ 图片 Tab(对齐 Uniapp 行 87-111) ============

interface ImageTabProps {
  list: readonly ImageContent[]
  pagination: ContentPagination
  onPreview: (images: readonly string[], index: number) => void
}

function ImageTabContent({ list, onPreview }: ImageTabProps): React.JSX.Element {
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
          {/* 图片单列满宽(对齐 Uniapp 行 87-111 单列布局) */}
          <View style={[styles.contentBody, styles.imageColumn]}>
            {item.imageList.map((url, idx) => (
              <TouchableOpacity
                key={`${url}-${idx}`}
                activeOpacity={0.85}
                onPress={() => onPreview(item.imageList, idx)}
                style={styles.imageColumnItem}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.imageColumnImg}
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
  // FloatBox 浮层提示(替代 Alert.alert 非阻塞反馈)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])
  const [downloading, setDownloading] = useState(false)

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

  const onDownload = useCallback(async () => {
    if (!item.audioUrl) {
      showToast('warning', '音频地址无效')
      return
    }
    if (downloading) return
    setDownloading(true)
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        showToast('warning', '需要媒体库权限才能保存音频')
        return
      }
      const filename = `audio_${Date.now()}.mp3`
      const destFile = new FileSystem.File(FileSystem.Paths.cache, filename)
      const downloaded = await FileSystem.File.downloadFileAsync(item.audioUrl, destFile, {
        idempotent: true,
      })
      await MediaLibrary.saveToLibraryAsync(downloaded.uri)
      showToast('success', '音频已保存到媒体库')
    } catch {
      showToast('error', '下载失败,请重试')
    } finally {
      setDownloading(false)
    }
  }, [item.audioUrl, downloading, showToast])

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
          {/* 进度条(对齐 Uniapp 行 166-175 原生 <slider> 可拖动)。
              当前用 Pressable 仅支持点击跳转;待安装 @react-native-community/slider
              后改为可拖动 Slider 组件 + onSlidingComplete 回调(不引入新依赖,保持现状) */}
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
            disabled={downloading}
          >
            <Text style={styles.audioDownloadIcon}>{downloading ? '⋯' : '⬇'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FloatBox
        visible={toastVisible}
        type={toastType}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
      />
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

  /** 分享当前预览图片(对齐 Uniapp showImageSharePopup / handleAppShareClick 行 1409+) */
  const onShare = useCallback(async () => {
    const currentUrl = images[index] ?? images[0] ?? ''
    if (!currentUrl) {
      Alert.alert('提示', '暂无可分享的图片')
      return
    }
    try {
      await Share.share({
        message: currentUrl,
        url: currentUrl,
        title: '分享图片',
      })
    } catch {
      Alert.alert('提示', '分享失败,请重试')
    }
  }, [images, index])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.previewOverlay}>
        <TouchableOpacity
          onPress={onShare}
          style={styles.previewShareBtn}
          activeOpacity={0.7}
          accessibilityLabel="分享图片"
        >
          <Text style={styles.previewShareText}>分享</Text>
        </TouchableOpacity>
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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.videoModalOverlay}>
          {/* 内容区阻止冒泡,避免点击视频/按钮触发遮罩关闭(对齐 Uniapp 行 220/237/243 遮罩点击关闭) */}
          <TouchableWithoutFeedback onPress={() => undefined}>
            <View style={styles.videoModalContent}>
              <View style={{ width: videoWidth, height: videoHeight, borderRadius: 8, overflow: 'hidden' }}>
                {url ? <VideoPlayer url={url} /> : null}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.videoModalClose} activeOpacity={0.7}>
                <Text style={styles.videoModalCloseText}>×</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

// ============ 辅助函数(对齐 Uniapp formatAudioTime / getVideoPoster) ============

/** 官网链接(对齐 Uniapp copyWebsiteLink 行 1316 'https://www.aizhs.top') */
const WEBSITE_URL = 'https://www.aizhs.top'

/**
 * 把 API 返回的 ConversationDetail 映射为 DrawerConversationItem。
 * 对齐 Uniapp getModelChat 返回的 { id, title, time, modelName } 结构。
 * - title: 空标题回退 "未命名对话"(对齐 miniapp-compat-routes.ts 行 1547)
 * - modelConfig: 用 conversation.model 作为模型名(空则由 Drawer 内部回退 "默认模型")
 * - createdAt: 优先 lastMessageAt(最近活跃),回退 updatedAt → createdAt
 */
function mapConversationToDrawer(c: ConversationDetail): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const model = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || '未命名对话',
    modelConfig: model
      ? { id: model, name: model, icon: undefined }
      : undefined,
    createdAt,
  }
}

/** 免费资料飞书链接(Drawer 领取免费资料 → 复制到剪贴板,对齐 Uniapp user/index.vue 行 682 lingqu) */
const FREE_RESOURCE_URL = 'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh?from=from_copylink'

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
  loaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  userInfoCardWrap: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
  contentSection: {
    // 对齐 Uniapp 20rpx(≈10px)水平 padding
    paddingHorizontal: 10,
    paddingBottom: 12,
  },
  // 会员权益折叠头(对齐 Uniapp user/index.vue 行 30 toggleMembershipBenefits)
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.surface.card,
    borderRadius: 8,
    marginTop: 8,
  },
  membershipHeaderText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  membershipArrow: {
    transform: [{ rotate: '0deg' }],
  },
  membershipArrowExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  // 会员权益内容容器(对齐 Uniapp 10rpx(≈5px)与折叠头间距)
  membershipBenefitsWrap: {
    marginTop: 5,
  },
  tabBarWrap: {
    // 对齐 Uniapp 20rpx(≈10px)Tab 区下方间距
    marginBottom: 10,
  },
  contentDisplayArea: {
    // 对齐 Uniapp(删除大容器圆角,改 minHeight + marginBottom + 紧凑 padding)
    minHeight: 100,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  listContent: {
    gap: 0,
  },
  itemGap: {
    height: 12,
  },
  contentItem: {
    // 对齐 Uniapp border-radius:20rpx(≈10px) padding:28rpx(≈14px) border:1px #EEEEEE
    borderRadius: 10,
    backgroundColor: tokens.surface.light,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  copyLinkBtn: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  copyLinkText: {
    fontSize: 12,
    color: tokens.text.secondary,
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
    // 对齐 Uniapp font-size:32rpx(≈16px)
    fontSize: 16,
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
    // 对齐 Uniapp font-size:28rpx(≈14px) line-height:1.8(≈25)
    fontSize: 14,
    lineHeight: 25,
    color: tokens.text.secondary,
  },
  imageColumn: {
    gap: 8,
  },
  imageColumnItem: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageColumnImg: {
    width: '100%',
    height: 200,
    borderRadius: 8,
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
    // 对齐 Uniapp 圆形 border-radius:50%(60/2=30 圆形,头像类豁免)
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -30,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  previewShareBtn: {
    position: 'absolute',
    top: 48,
    right: 72,
    zIndex: 2,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewShareText: {
    fontSize: 14,
    color: '#ffffff',
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
    fontSize: 30,
    color: '#ffffff',
    lineHeight: 30,
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
    fontSize: 30,
    color: '#ffffff',
    lineHeight: 30,
  },
  // ── 4 Tab 加载/错误状态(对齐 Uniapp loadContentByTab 加载体验) ──
  tabLoaderWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  tabErrorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  tabErrorText: {
    fontSize: 14,
    color: tokens.text.secondary,
    textAlign: 'center',
  },
  tabRetryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
  },
  tabRetryText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.surface.light,
  },
  // ── 等级介绍按钮(对齐 Uniapp level-intro 入口,UserInfoCard 下方独立按钮) ──
  levelIntroBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: tokens.surface.muted,
  },
  levelIntroBtnText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  // ── 编辑资料 Modal(对齐 Uniapp 编辑资料弹层) ──
  editProfileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editProfileCard: {
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    paddingBottom: 32,
  },
  editProfileTitle: {
    // 对齐 Uniapp 32rpx(≈16px)标题字号
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  editProfileAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  editProfileAvatarBtn: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
  },
  editProfileAvatar: {
    width: 72,
    height: 72,
    resizeMode: 'cover',
  },
  editProfileAvatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileAvatarBadgeText: {
    fontSize: 14,
    color: tokens.surface.light,
    fontWeight: '700',
    lineHeight: 14,
  },
  editProfileAvatarHint: {
    fontSize: 11,
    color: tokens.text.tertiary,
  },
  editProfileField: {
    // 对齐 Uniapp 30rpx(≈15px)字段间距
    marginBottom: 15,
    gap: 6,
  },
  editProfileLabel: {
    fontSize: 13,
    color: tokens.text.secondary,
  },
  editProfileInput: {
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: tokens.text.primary,
    backgroundColor: tokens.surface.light,
  },
  editProfileInputReadOnly: {
    backgroundColor: tokens.surface.muted,
    color: tokens.text.secondary,
  },
  editProfileBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editProfileCancelBtn: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileCancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  editProfileSaveBtn: {
    flex: 1,
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileSaveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  editProfileSaveBtnDisabled: {
    opacity: 0.6,
  },
  editProfileError: {
    fontSize: 12,
    color: tokens.danger.DEFAULT,
    marginBottom: 8,
  },
  // ── 等级介绍 Modal(对齐 Uniapp level-intro popup) ──
  levelIntroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  levelIntroCard: {
    backgroundColor: tokens.surface.card,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  levelIntroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  levelIntroScroll: {
    marginBottom: 16,
  },
  levelIntroItem: {
    backgroundColor: tokens.surface.light,
    borderRadius: 8,
    // 对齐 Uniapp 8rpx(≈4px)benefit-item padding
    padding: 4,
    marginBottom: 10,
  },
  levelIntroItemHeader: {
    marginBottom: 8,
    gap: 4,
  },
  levelIntroItemLevel: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  levelIntroItemDesc: {
    fontSize: 12,
    color: tokens.text.tertiary,
  },
  levelIntroBenefitList: {
    gap: 4,
  },
  levelIntroBenefitItem: {
    // 对齐 Uniapp 28rpx(≈14px)benefit-item 字号
    fontSize: 14,
    color: tokens.text.secondary,
    lineHeight: 20,
  },
  levelIntroCloseBtn: {
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelIntroCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  },
  // ── 退订确认 Modal(对齐 Uniapp 退订确认弹层,替代 Alert.alert) ──
  unsubscribeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  unsubscribeCard: {
    width: '100%',
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  unsubscribeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.danger.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  unsubscribeIcon: {
    fontSize: 28,
    color: tokens.danger.DEFAULT,
    lineHeight: 28,
  },
  unsubscribeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.text.primary,
    marginBottom: 8,
  },
  unsubscribeDesc: {
    fontSize: 13,
    color: tokens.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  unsubscribeBtnRow: {
    flexDirection: 'row',
    gap: 12,
    alignSelf: 'stretch',
  },
  unsubscribeCancelBtn: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsubscribeCancelBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  },
  unsubscribeConfirmBtn: {
    flex: 1,
    backgroundColor: tokens.danger.DEFAULT,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsubscribeConfirmBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  },
})
