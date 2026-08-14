/**
 * Drawer 侧滑抽屉组件 (mobile-rn 端) — 完整版
 *
 * 1:1 复刻历史 Uniapp DrawerComponentall.vue:
 * - 顶部用户区(头像 + 昵称 + 等级标识 VIP/普通)
 * - 5 主菜单(AI 对话社区 / AI 应用 / 广场 / 动态 / 我的,对齐 Uniapp 5 主入口)
 * - 一人公司入口 / 领取免费资料 / 创建新对话(对齐 Uniapp label_content)
 * - 历史对话列表:按模型分组 → 按日期分组(今天/昨天/更早) → 左滑删除
 * - 底部操作区:设置 / 消息 / 回到主页(对齐 Uniapp bottom_userInfo + back_index_btn)
 *
 * 左侧滑入,半透明遮罩(bg-black/50),80% 屏宽(最大 320dp)。
 * 左滑删除用 Animated + PanResponder 自定义实现(无 react-native-gesture-handler 依赖)。
 *
 * 平台特有:依赖 RN Animated/PanResponder/Modal/SafeAreaContext,不适合共享。
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  PanResponder,
  type PanResponderInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Bot,
  Building2,
  ChevronRight,
  Gift,
  Home,
  LayoutGrid,
  MessageCircle,
  Plus,
  Settings,
  Share2,
  Trash2,
  User,
} from 'lucide-react-native'

// ── 类型定义(强类型,禁用 any) ──

export type DrawerTab = 'home' | 'ai' | 'square' | 'share' | 'mine'
/**
 * 扩展菜单(对齐 Uniapp DrawerComponentall.vue 行 14-40 隐藏菜单 + label_content 入口)。
 * 独立于 DrawerTab 以避免破坏 ChatScreen 的 `Record<DrawerTab, ...>` 严格映射
 * (任务禁止改 ChatScreen,故新增独立类型 + 可选回调)。
 * 主 agent 后续可在 ChatScreen 接 onNavigateExtra 实现真实跳转:
 *   tools→AiAssistant/AgentScreen, aigc→AigcList, learn→StudyIndex,
 *   modelPlaza→ModelPlaza, company→WorkPanel(路由均已注册,见 RootNavigator 行 673-698)。
 */
export type DrawerExtraMenu = 'tools' | 'aigc' | 'learn' | 'modelPlaza' | 'company'
export type DrawerUserLevel = 'vip' | 'normal'

export interface DrawerModelConfig {
  id: string
  name: string
  icon?: string
}

export interface DrawerConversationItem {
  id: string
  title: string
  modelConfig?: DrawerModelConfig
  createdAt: number // timestamp,用于日期分组
}

export interface DrawerProps {
  visible: boolean
  onClose: () => void
  // 用户信息
  user: {
    avatar?: string
    nickname: string
    level?: DrawerUserLevel
  }
  // 历史对话列表
  conversations: DrawerConversationItem[]
  // 回调
  onNavigate: (tab: DrawerTab) => void
  /**
   * 扩展菜单跳转回调(可选)。未传入时点击扩展菜单弹 Alert 占位。
   * 主 agent 后续在 ChatScreen 接入即可激活真实跳转。
   */
  onNavigateExtra?: (menu: DrawerExtraMenu) => void
  onNavigateCompany: () => void // 一人公司
  onClaimFree: () => void // 领取免费资料
  onCreateNewChat: () => void // 创建新对话
  onSelectConversation: (id: string) => void // 选择历史对话
  onDeleteConversation: (id: string) => void // 删除历史对话
  onOpenSettings: () => void // 设置
  onOpenMessages: () => void // 消息
  onGoHome: () => void // 回到主页
}

// ── 常量 ──

const MAX_DRAWER_WIDTH = 256
const DRAWER_WIDTH_RATIO = 0.66
const ANIM_DURATION_MS = 250
const OVERLAY_OPACITY = 0.5
const DELETE_WIDTH = 50 // 左滑露出的删除按钮宽度(对齐 Uniapp 101rpx ≈ 50dp)
const SWIPE_THRESHOLD = 28 // 触发展开删除的位移阈值
const DAY_MS = 24 * 60 * 60 * 1000

// ── 主菜单配置(对齐 Uniapp 5 主入口,RN 端 tab 结构) ──

interface MainMenuConfig {
  key: DrawerTab
  label: string
  Icon: typeof Home
}

const MAIN_MENUS: readonly MainMenuConfig[] = [
  { key: 'home', label: 'AI 对话社区', Icon: Home },
  { key: 'ai', label: 'AI 应用', Icon: Bot },
  { key: 'square', label: '广场', Icon: LayoutGrid },
  { key: 'share', label: '动态', Icon: Share2 },
  { key: 'mine', label: '我的', Icon: User },
] as const

// ── 扩展菜单配置(对齐 Uniapp 行 14-40 隐藏菜单 + label_content 入口) ──
// emoji 图标对齐 GlobalFloatBox 风格(任务约束:菜单项图标用 emoji)。
// 5 项分别对应 Uniapp:应用商店/灵感/课程/模型广场(隐藏)/我的一人公司。

interface ExtraMenuConfig {
  key: DrawerExtraMenu
  label: string
  emoji: string
}

const EXTRA_MENUS: readonly ExtraMenuConfig[] = [
  { key: 'tools', label: '工具', emoji: '🔧' },
  { key: 'aigc', label: 'AIGC', emoji: '🎨' },
  { key: 'learn', label: '学习', emoji: '📚' },
  { key: 'modelPlaza', label: '模型广场', emoji: '🤖' },
  { key: 'company', label: '一人公司', emoji: '🏢' },
] as const

// ── 日期分组逻辑 ──

type DateBucket = 'today' | 'yesterday' | 'earlier'

const DATE_LABELS: Record<DateBucket, string> = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
}

const DATE_ORDER: readonly DateBucket[] = ['today', 'yesterday', 'earlier']

interface DateGroup {
  bucket: DateBucket
  label: string
  list: DrawerConversationItem[]
}

interface ModelGroup {
  modelName: string
  modelIcon?: string
  dateGroups: DateGroup[]
}

function getStartOfToday(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function getDateBucket(createdAt: number, todayStart: number): DateBucket {
  if (createdAt >= todayStart) return 'today'
  if (createdAt >= todayStart - DAY_MS) return 'yesterday'
  return 'earlier'
}

/**
 * 按模型分组 → 每个模型组内按日期分组(今天/昨天/更早)。
 * 组内按 createdAt 降序(最新在前);"默认模型" 排最后(对齐 Uniapp sortedGroupedData)。
 */
function groupByModelAndDate(conversations: DrawerConversationItem[]): ModelGroup[] {
  const now = Date.now()
  const todayStart = getStartOfToday(now)

  const modelMap = new Map<string, { name: string; icon?: string; items: DrawerConversationItem[] }>()
  for (const conv of conversations) {
    const name = conv.modelConfig?.name ?? '默认模型'
    const icon = conv.modelConfig?.icon
    const entry = modelMap.get(name)
    if (entry) {
      entry.items.push(conv)
    } else {
      modelMap.set(name, { name, icon, items: [conv] })
    }
  }

  const groups: ModelGroup[] = []
  for (const { name, icon, items } of modelMap.values()) {
    items.sort((a, b) => b.createdAt - a.createdAt)
    const bucketMap = new Map<DateBucket, DrawerConversationItem[]>()
    for (const item of items) {
      const bucket = getDateBucket(item.createdAt, todayStart)
      const arr = bucketMap.get(bucket)
      if (arr) {
        arr.push(item)
      } else {
        bucketMap.set(bucket, [item])
      }
    }
    const dateGroups: DateGroup[] = DATE_ORDER.filter((b) => bucketMap.has(b)).map((b) => ({
      bucket: b,
      label: DATE_LABELS[b],
      list: bucketMap.get(b) as DrawerConversationItem[],
    }))
    groups.push({ modelName: name, modelIcon: icon, dateGroups })
  }

  groups.sort((a, b) => {
    if (a.modelName === '默认模型') return 1
    if (b.modelName === '默认模型') return -1
    return a.modelName.localeCompare(b.modelName, 'zh-CN')
  })
  return groups
}

// ── 左滑删除项(Animated + PanResponder 自定义实现) ──

interface SwipeItemProps {
  item: DrawerConversationItem
  isOpen: boolean
  onOpen: (id: string) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function SwipeableConversationItem({ item, isOpen, onOpen, onSelect, onDelete }: SwipeItemProps) {
  const translateX = useRef(new Animated.Value(0)).current
  // 用 ref 跟踪当前 offset / 最后位移,避免读取 Animated.Value 私有字段(_value)
  const offsetRef = useRef(0)
  const lastXRef = useRef(0)

  const panResponder = useMemo<PanResponderInstance>(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          lastXRef.current = offsetRef.current
        },
        onPanResponderMove: (_e, g) => {
          const next = Math.max(-DELETE_WIDTH, Math.min(0, offsetRef.current + g.dx))
          lastXRef.current = next
          translateX.setValue(next)
        },
        onPanResponderRelease: () => {
          const shouldOpen = lastXRef.current < -SWIPE_THRESHOLD
          const target = shouldOpen ? -DELETE_WIDTH : 0
          offsetRef.current = target
          Animated.spring(translateX, {
            toValue: target,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start()
          if (shouldOpen) onOpen(item.id)
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: offsetRef.current,
            useNativeDriver: true,
          }).start()
        },
      }),
    [item.id, onOpen, translateX]
  )

  // 外部强制关闭(当 openSwipeId 切换到其他 item 时,本 item 收起)
  useEffect(() => {
    if (!isOpen && offsetRef.current !== 0) {
      offsetRef.current = 0
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
    }
  }, [isOpen, translateX])

  const handleSelect = () => {
    if (offsetRef.current !== 0) {
      // 处于打开状态,先收起,不触发选择
      offsetRef.current = 0
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
      return
    }
    onSelect(item.id)
  }

  const handleDelete = () => {
    onDelete(item.id)
  }

  return (
    <View className="relative overflow-hidden">
      {/* 删除按钮(底层,右侧露出) */}
      <View
        className="absolute top-0 bottom-0 right-0 items-center justify-center"
        style={{ width: DELETE_WIDTH, backgroundColor: tokens.danger.DEFAULT }}
      >
        <Pressable
          className="items-center justify-center"
          style={{ width: DELETE_WIDTH, height: '100%' }}
          onPress={handleDelete}
          accessibilityLabel={`删除对话 ${item.title}`}
        >
          <Trash2 size={20} color={tokens.surface.light} />
          <Text className="text-[11px] text-white mt-1">删除</Text>
        </Pressable>
      </View>
      {/* 内容(上层,跟随手势平移) */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          className="flex-row items-center px-4 py-3 bg-white"
          onPress={handleSelect}
          android_ripple={{ color: tokens.surface.muted }}
        >
          <Text className="flex-1 text-[14px] text-gray-900" numberOfLines={1}>
            {item.title}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

// ── 主组件 ──

export function Drawer(props: DrawerProps) {
  const {
    visible,
    onClose,
    user,
    conversations,
    onNavigate,
    onNavigateExtra,
    onNavigateCompany,
    onClaimFree,
    onCreateNewChat,
    onSelectConversation,
    onDeleteConversation,
    onOpenSettings,
    onOpenMessages,
    onGoHome,
  } = props

  const insets = useSafeAreaInsets()
  const screenWidth = Dimensions.get('window').width
  const drawerWidth = Math.min(screenWidth * DRAWER_WIDTH_RATIO, MAX_DRAWER_WIDTH)

  // progress: 0 = 隐藏, 1 = 显示
  const progress = useRef(new Animated.Value(0)).current
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: ANIM_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, visible])

  // 关闭抽屉时重置左滑状态
  useEffect(() => {
    if (!visible) setOpenSwipeId(null)
  }, [visible])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth - 20, 0],
  })
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, OVERLAY_OPACITY],
  })

  const modelGroups = useMemo(() => groupByModelAndDate(conversations), [conversations])

  const handleSwipeOpen = useCallback((id: string) => {
    setOpenSwipeId((prev) => (prev === id ? prev : id))
  }, [])

  const handleNavigate = (tab: DrawerTab) => {
    onNavigate(tab)
    onClose()
  }

  /**
   * 扩展菜单点击:父级未接 onNavigateExtra 时 Alert 占位(对齐任务"依赖缺失用 Alert"约束)。
   * 路由均已注册(RootNavigator 行 673-698),主 agent 后续在 ChatScreen 接回调即可激活。
   */
  const handleNavigateExtra = (menu: DrawerExtraMenu) => {
    if (onNavigateExtra) {
      onNavigateExtra(menu)
    } else {
      const labelMap: Record<DrawerExtraMenu, string> = {
        tools: '工具',
        aigc: 'AIGC',
        learn: '学习',
        modelPlaza: '模型广场',
        company: '一人公司',
      }
      Alert.alert(labelMap[menu], '功能开发中(待接入路由)')
    }
    onClose()
  }

  const handleSelectConversation = (id: string) => {
    onSelectConversation(id)
    onClose()
  }

  // 头像:有 URL -> Image, 否则用首字母(initials)
  const nickname = user.nickname || '未登录'
  const initials = nickname.slice(0, 1).toUpperCase()
  const isVip = user.level === 'vip'

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1">
        {/* 半透明遮罩 */}
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* 抽屉主体(左侧滑入) */}
        <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
          <View
            className="flex-1 bg-white"
            style={{
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              borderTopRightRadius: 15,
              borderBottomRightRadius: 15,
            }}
          >
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {/* 1. 顶部用户区:头像 + 昵称 + 等级标识 + 关闭按钮 */}
              {/* 头部横向 padding 14dp(对齐 Uniapp 28rpx)/ 底部 12dp(对齐 Uniapp 25rpx≈12.5dp) */}
              <View className="pt-3 pb-3 flex-row items-center gap-3" style={{ paddingHorizontal: 14 }}>
                <View className="relative">
                  {user.avatar ? (
                    <Image
                      source={{ uri: user.avatar }}
                      className="rounded-full"
                      style={{ width: 60, height: 60 }}
                    />
                  ) : (
                    <View
                      className="rounded-full items-center justify-center bg-gray-100"
                      style={{ width: 60, height: 60 }}
                    >
                      <Text className="text-[16px] font-semibold text-gray-700">{initials}</Text>
                    </View>
                  )}
                  {isVip ? (
                    <View className="absolute -top-1 -right-1 px-1 py-0.5 rounded-md bg-purple">
                      <Text className="text-[9px] font-bold text-white leading-tight">VIP</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-gray-900" numberOfLines={1}>
                    {nickname}
                  </Text>
                  <View className="mt-1">
                    {isVip ? (
                      <View className="self-start px-1.5 py-0.5 rounded-md bg-purple-light">
                        <Text className="text-[10px] text-purple font-medium">VIP 会员</Text>
                      </View>
                    ) : (
                      <View className="self-start px-1.5 py-0.5 rounded-md bg-gray-100">
                        <Text className="text-[10px] text-gray-500">普通用户</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  className="w-8 h-8 items-center justify-center rounded-lg"
                  hitSlop={8}
                  onPress={onClose}
                  accessibilityLabel="关闭抽屉"
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <Text className="text-[22px] text-gray-400 leading-none">×</Text>
                </Pressable>
              </View>

              {/* 2. 5 主菜单(横向等分,对齐 Uniapp drawer_menu;容器 padding 8dp 对齐 Uniapp 15rpx≈7.5dp) */}
              <View className="py-2 flex-row items-start justify-between" style={{ paddingHorizontal: 14 }}>
                {MAIN_MENUS.map(({ key, label, Icon }) => (
                  <Pressable
                    key={key}
                    className="flex-1 items-center py-1.5 rounded-lg"
                    onPress={() => handleNavigate(key)}
                    android_ripple={{ color: tokens.surface.muted, radius: 60 }}
                  >
                    <View className="rounded-xl items-center justify-center bg-gray-50 mb-1" style={{ width: 30, height: 30 }}>
                      <Icon size={22} color={tokens.text.primary} />
                    </View>
                    <Text className="text-[11px] text-gray-700 text-center">{label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* 2b. 5 扩展菜单(横向等分,对齐 Uniapp 隐藏菜单 + label_content 入口;emoji 图标对齐 GlobalFloatBox 风格) */}
              <View className="py-2 flex-row items-start justify-between" style={{ paddingHorizontal: 14 }}>
                {EXTRA_MENUS.map(({ key, label, emoji }) => (
                  <Pressable
                    key={key}
                    className="flex-1 items-center py-1.5 rounded-lg"
                    onPress={() => handleNavigateExtra(key)}
                    android_ripple={{ color: tokens.surface.muted, radius: 60 }}
                  >
                    <View className="rounded-xl items-center justify-center bg-gray-50 mb-1" style={{ width: 30, height: 30 }}>
                      <Text className="text-[22px] leading-none">{emoji}</Text>
                    </View>
                    <Text className="text-[11px] text-gray-700 text-center">{label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* 3-5. 入口列表:一人公司 / 领取免费资料 / 创建新对话(对齐 Uniapp label_content) */}
              <View className="px-2 py-2 gap-0.5">
                <Pressable
                  className="flex-row items-center px-3 py-2.5 rounded-lg"
                  onPress={onNavigateCompany}
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center bg-indigo-50 mr-3">
                    <Building2 size={18} color="#4f46e5" />
                  </View>
                  <Text className="flex-1 text-[14px] text-gray-900">我的一人公司</Text>
                  <ChevronRight size={16} color={tokens.text.tertiary} />
                </Pressable>
                <Pressable
                  className="flex-row items-center px-3 py-2.5 rounded-lg"
                  onPress={onClaimFree}
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center bg-success-lighter mr-3">
                    <Gift size={18} color={tokens.success.DEFAULT} />
                  </View>
                  <Text className="flex-1 text-[14px] text-gray-900">领取免费资料</Text>
                  <ChevronRight size={16} color={tokens.text.tertiary} />
                </Pressable>
                <Pressable
                  className="flex-row items-center px-3 py-2.5 rounded-lg"
                  onPress={onCreateNewChat}
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <View className="w-8 h-8 rounded-lg items-center justify-center bg-purple-light mr-3">
                    <Plus size={18} color={tokens.purple.DEFAULT} />
                  </View>
                  <Text className="flex-1 text-[14px] text-gray-900">创建新对话</Text>
                  <ChevronRight size={16} color={tokens.text.tertiary} />
                </Pressable>
              </View>

              {/* 6. 历史对话列表(按模型分组 → 按日期分组 → 左滑删除) */}
              <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
                <Text className="text-[14px] font-bold text-gray-900">历史对话</Text>
                <Text className="text-[11px] text-gray-400">左滑删除</Text>
              </View>

              {modelGroups.length === 0 ? (
                <View className="px-4 py-8 items-center">
                  <Text className="text-[13px] text-gray-400">暂无历史对话</Text>
                </View>
              ) : (
                <View className="px-2">
                  {modelGroups.map((mg) => (
                    <View key={mg.modelName} className="mb-3">
                      {/* 模型标题(对齐 Uniapp model-title + model-logo) */}
                      <View className="flex-row items-center px-3 py-1.5">
                        {mg.modelIcon ? (
                          <Image
                            source={{ uri: mg.modelIcon }}
                            className="w-4 h-4 rounded-sm mr-1.5"
                          />
                        ) : (
                          <View className="w-4 h-4 rounded-sm bg-gray-200 mr-1.5 items-center justify-center">
                            <Bot size={10} color={tokens.text.secondary} />
                          </View>
                        )}
                        <Text className="text-[12px] font-semibold text-gray-600">
                          {mg.modelName}
                        </Text>
                      </View>
                      {/* 日期分组(对齐 Uniapp date-group + date-title) */}
                      {mg.dateGroups.map((dg) => (
                        <View key={dg.bucket} className="ml-3 mb-1">
                          <Text className="text-[11px] text-gray-400 px-3 py-1">{dg.label}</Text>
                          {dg.list.map((item) => (
                            <SwipeableConversationItem
                              key={item.id}
                              item={item}
                              isOpen={openSwipeId === item.id}
                              onOpen={handleSwipeOpen}
                              onSelect={handleSelectConversation}
                              onDelete={onDeleteConversation}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* 7. 底部操作区:回到主页 + 设置 + 消息(对齐 Uniapp back_index_btn + bottom_userInfo) */}
            <View className="px-4 py-3 flex-row items-center justify-between bg-white">
              <Pressable
                className="flex-row items-center gap-1.5 py-1.5 px-2 rounded-lg"
                onPress={onGoHome}
                android_ripple={{ color: tokens.surface.muted }}
              >
                <Home size={18} color={tokens.text.secondary} />
                <Text className="text-[13px] text-gray-700">回到主页</Text>
              </Pressable>
              <View className="flex-row items-center gap-1">
                <Pressable
                  className="w-6 h-6 items-center justify-center rounded-lg"
                  onPress={onOpenSettings}
                  accessibilityLabel="设置"
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <Settings size={20} color={tokens.text.secondary} />
                </Pressable>
                <Pressable
                  className="w-6 h-6 items-center justify-center rounded-lg"
                  onPress={onOpenMessages}
                  accessibilityLabel="消息"
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <MessageCircle size={20} color={tokens.text.secondary} />
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.surface.light,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 0 },
    elevation: 8,
  },
})

export default Drawer
