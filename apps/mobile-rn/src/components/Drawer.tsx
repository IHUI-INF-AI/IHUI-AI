// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Drawer 侧滑抽屉组件 (mobile-rn 端) — web 侧边栏同构版(2026-10-15 重构,2026-10-20 对齐)。
 *
 * 2026-10-20 对齐(本次只动 RN 端,web 一行未改):导航清单迁出到
 * `navigation/drawer-nav.ts` 单源,分组顺序与命名对齐 web `sidebar/nav-data.ts`
 * —— 首页行 → 热门 → AI → 教育域 → 内容域 → 交易域 → 社区域 → 个人 → 推广 →
 * 高级工具 → 开发者。同时补齐此前两端差距最大的三处:
 *   ① 二级子菜单(children):知识库 / 我的学习 / 用户中心 与 web 同为可展开父项;
 *   ② 内容域入口:web 有 /domains/content,RN 此前完全没有这一域;
 *   ③ 内容顺序:历史对话上移到快捷区下方、分组之上(web 就是这个顺序,
 *      RN 此前把历史压在所有分组之下)。
 * web 有而 RN 无原生路由的项(插件市场 / 媒体任务 / 生态 / 学生)一律不渲染,
 * 不放假入口;RN 独有的组(社区域 / 推广 / 高级工具 / 开发者)按授权保留,
 * 统一排在 web 骨架之后。
 *
 * 其余结构与 web 的同构点:
 * - Header:logo 方标 26(亮/暗双图,点击回首页并收拢;web ThemeLogo mobile 变体高 26)
 *   + PanelLeftRounded 收拢钮(36 命中方块,tapBox 档)
 * - 快捷区:「新建任务」灰底行 + 「自动化任务」(对应 web 快捷区第 3 枚)
 * - 历史对话:按模型分组 → 按日期分组(今天/昨天/更早) → 左滑收藏/删除(机制原样保留)
 * - 分组竖排导航:行几何对齐 web NAV_ITEM_BASE_CLASS(h-9 gap-2.5 px-2.5 rounded-md,
 *   图标 20/文字 14),active 行 = brand.cta 底 + ctaForeground 字;
 *   二级父行 = 行主体进父项路由 + 右侧 36 命中方块就地展开(web ExpandableNavItem 同构);
 *   可折叠分组标题(text-xs uppercase,折时 ChevronDown -90 度);
 *   域入口行(教育/内容/交易/社区)右侧 ChevronRight 表可进入二级屏
 * - 底部 UserRow:头像 24 + 昵称(对齐 web SidebarUserRow),点击上浮菜单
 *   (我的/会员/消息/设置/主题/领取资料/退出登录;未登录显登录入口 → Login 路由)
 *
 * 左侧滑入,半透明遮罩(收口到 --color-black-40 同一档:0.4,与小程序端同值),
 * 0.66 屏宽、封顶取几何档 rnGeometry.drawerWidth(250,与小程序 500rpx 同源)。
 * 左滑操作(收藏+删除)用 Animated + PanResponder 自定义实现(无 react-native-gesture-handler 依赖)。
 *
 * 平台特有:依赖 RN Animated/PanResponder/Modal/SafeAreaContext,不适合共享。
 */
import { tokens } from '../theme/active-tokens'
import { rnGeometry, rnRadius, rnRadiusFor, rnSpacing } from '@ihui/design-tokens'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  type PanResponderInstance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { appAlert } from './BottomPops'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useNavigationState } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { DOMAIN_HUBS, type DomainKey, type HubGlyph } from '../navigation/domain-hub'
import {
  DRAWER_AUTOMATION_ITEM,
  DRAWER_HOME_ITEM,
  DRAWER_NAV_GROUPS,
  DRAWER_NAV_SECTIONS,
  type DrawerNavItem,
  type DrawerNavTarget,
} from '../navigation/drawer-nav'
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Settings,
  Star,
  Sun,
  Trash2,
  User,
} from 'lucide-react-native'
import { PanelLeftRounded } from '../components/PanelLeftRounded'
import { favoriteConversation, unfavoriteConversation } from '@ihui/api-client'
// logo 取源:亮/暗双图(与 LoginScreen 主题感知同款资产;logo.png 同时是 App 图标流水线源,勿删)
// 静态 import 走 declarations.d.ts 的图片模块声明(Metro 标准形态,无需 lint 抑制)
import LOGO_LIGHT from '../../assets/images/logo.png' // icon-bitmap-exempt: 品牌多色插画 logo(非线形 UI 图标,web 同一资产,暂无矢量等价物) until 2027-01-15
import LOGO_DARK from '../../assets/images/logo-dark.png' // icon-bitmap-exempt: 品牌多色插画 logo 暗主题版(同 LOGO_LIGHT 理由) until 2027-01-15

// ── 类型定义(强类型,禁用 any) ──

export type DrawerTab = 'home' | 'ai' | 'square' | 'share' | 'mine'
/**
 * 扩展菜单类型(历史契约保留:ChatScreen 等调用方仍可传 onNavigateExtra;
 * web 同构版无对应入口,本组件不再渲染扩展菜单行,仅保留类型与可选 prop 兼容签名)。
 */
export type DrawerExtraMenu = 'tools' | 'aigc' | 'learn' | 'modelPlaza' | 'company' | 'assistant'
export type DrawerUserLevel = 'vip' | 'normal'

/** 扩展菜单兜底导航用的根栈导航类型 */
type DrawerNav = NativeStackNavigationProp<RootStackParamList>

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
  /** 收藏标记(列表 API favorite 字段;Drawer 内乐观覆盖,2026-09-05 立) */
  favorited?: boolean
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
  /** 历史契约保留(可选):调用方可传,web 同构版无扩展菜单入口,不再消费 */
  onNavigateExtra?: (menu: DrawerExtraMenu) => void
  /** 历史契约保留(可选):一人公司入口已并入导航分组,不再单独渲染 */
  onNavigateCompany?: () => void
  /** 历史契约保留(可选):领取免费资料入口挂底部用户行上浮菜单(复制飞书链接动作,无路由对应) */
  onClaimFree?: () => void
  onCreateNewChat: () => void // 创建新对话
  onSelectConversation: (id: string) => void // 选择历史对话
  onDeleteConversation: (id: string) => void // 删除历史对话
  onOpenSettings: () => void // 设置
  onOpenMessages: () => void // 消息
  onGoHome: () => void // 回到主页
}

// ── 常量 ──

// 抽屉宽度封顶收进几何档 rnGeometry.drawerWidth(250,与小程序 500rpx 同源) ——
// 端内不再留 MAX_DRAWER_WIDTH 这个第二数字;0.66 是窄屏自适应比例,属平台机制不是档。
const DRAWER_WIDTH_RATIO = 0.66
const ANIM_DURATION_MS = 250
// 遮罩不透明度对齐 --color-black-40(0.4):此前 RN 写 0.5、小程序走 token 0.4,两端反极。
const OVERLAY_OPACITY = 0.4
const DELETE_WIDTH = 50 // 左滑露出的删除按钮宽度(对齐 Uniapp 101rpx ≈ 50dp)
const FAVORITE_WIDTH = 50 // 左滑露出的收藏按钮宽度
const SWIPE_WIDTH = DELETE_WIDTH + FAVORITE_WIDTH // 左滑总露出宽度(收藏 + 删除)
const SWIPE_THRESHOLD = 28 // 触发展开删除的位移阈值
const DAY_MS = 24 * 60 * 60 * 1000
/**
 * 用户菜单浮层距抽屉底部的偏移 = 行高 36(h-9 = tapBox) + pb-2(8) + 间隙 4。
 * 行高取 tapBox 档;8/4 是 web UserRow 同款外距(px-2 容器 + 行间距),不另立档。
 */
const USER_MENU_BOTTOM_OFFSET = rnGeometry.tapBox + 12

/** logo 方标 26:web ThemeLogo mobile 变体高度(h-[26px]),RN 方形标取同值,不横拉变形 */
const HEADER_LOGO_SIZE = 26
/** UserRow 头像 24:web SidebarUserRow 头像 h-6 w-6 同源 */
const USER_AVATAR_SIZE = 24

// ── 导航分组配置(对齐 web nav-data.ts 信息架构;label 全走 i18n 既有键) ──

/** 图标组件类型(与抽屉导航单源同源 lucide-react-native) */
type LucideGlyph = HubGlyph

// ── 导航分组配置:单源已迁到 ../navigation/drawer-nav.ts(2026-10-20) ──
// 抽屉原本在本文件内嵌一份清单(4 个分组 / 21 条),与 web 端 sidebar/nav-data.ts 各写一份 ——
// 两份清单必然漂移(§0.6 单一真相源),实际后果就是用户看到的「两端侧边栏差距太大」。
// 现统一由 drawer-nav.ts 承载:分组顺序与命名对齐 web,条目只收 RN 真实可达路由,
// RN 独有的组(推广 / 高级工具 / 开发者)排在 web 骨架之后。本文件只负责渲染。

// ── 日期分组逻辑 ──

type DateBucket = 'today' | 'yesterday' | 'earlier'

const DATE_ORDER: readonly DateBucket[] = ['today', 'yesterday', 'earlier']

/**
 * 「默认模型」哨兵:分组与排序用它,渲染时才翻译(drawer.defaultModel)。
 * 端内不再落中文/英文第二份文案,groupByModelAndDate 保持纯数据。
 */
const DEFAULT_MODEL_NAME = '__default_model__'

interface DateGroup {
  bucket: DateBucket
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

  const modelMap = new Map<
    string,
    { name: string; icon?: string; items: DrawerConversationItem[] }
  >()
  for (const conv of conversations) {
    const name = conv.modelConfig?.name ?? DEFAULT_MODEL_NAME
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
      list: bucketMap.get(b) as DrawerConversationItem[],
    }))
    groups.push({ modelName: name, modelIcon: icon, dateGroups })
  }

  groups.sort((a, b) => {
    if (a.modelName === DEFAULT_MODEL_NAME) return 1
    if (b.modelName === DEFAULT_MODEL_NAME) return -1
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
  onToggleFavorite: (id: string, next: boolean) => void
}

function SwipeableConversationItem({
  item,
  isOpen,
  onOpen,
  onSelect,
  onDelete,
  onToggleFavorite,
}: SwipeItemProps) {
  const { t } = useI18n()
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
          const next = Math.max(-SWIPE_WIDTH, Math.min(0, offsetRef.current + g.dx))
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
    [item.id, onOpen, translateX],
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

  return (
    <View className="relative overflow-hidden">
      {/* 操作按钮(底层,右侧露出:收藏 + 删除) */}
      <View
        className="absolute top-0 bottom-0 right-0 flex-row items-stretch justify-end"
        style={{ width: SWIPE_WIDTH }}
      >
        <View
          className="items-center justify-center"
          style={{ width: FAVORITE_WIDTH, backgroundColor: tokens.warning.DEFAULT }}
        >
          <Pressable
            className="items-center justify-center"
            style={{ width: FAVORITE_WIDTH, height: '100%' }}
            onPress={() => onToggleFavorite(item.id, !item.favorited)}
            accessibilityLabel={`${item.favorited ? t('drawer.collected') : t('drawer.collect')} ${item.title}`}
          >
            <Star
              size={rnGeometry.glyphMd}
              color={tokens.surface.light}
              fill={item.favorited ? tokens.surface.light : 'transparent'}
            />
            <Text
              className="mt-1"
              style={{ color: tokens.surface.light, fontSize: rnGeometry.textCaption }}
            >
              {item.favorited ? t('drawer.collected') : t('drawer.collect')}
            </Text>
          </Pressable>
        </View>
        <View
          className="items-center justify-center"
          style={{ width: DELETE_WIDTH, backgroundColor: tokens.danger.DEFAULT }}
        >
          <Pressable
            className="items-center justify-center"
            style={{ width: DELETE_WIDTH, height: '100%' }}
            onPress={() => onDelete(item.id)}
            accessibilityLabel={`${t('drawer.delete')} ${item.title}`}
          >
            <Trash2 size={rnGeometry.glyphMd} color={tokens.surface.light} />
            <Text
              className="mt-1"
              style={{ color: tokens.surface.light, fontSize: rnGeometry.textCaption }}
            >
              {t('drawer.delete')}
            </Text>
          </Pressable>
        </View>
      </View>
      {/* 内容(上层,跟随手势平移) */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          className="flex-row items-center px-4 py-3"
          style={{ backgroundColor: tokens.surface.card }}
          onPress={handleSelect}
          android_ripple={{ color: tokens.surface.muted }}
        >
          <Text
            className="flex-1"
            style={{ color: tokens.text.primary, fontSize: rnGeometry.textBody }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

// ── 导航行(web NAV_ITEM_BASE_CLASS 同构:h-9 gap-2.5 px-2.5 rounded-md,图标 20/文字 14) ──

interface NavRowModel {
  key: string
  label: string
  Icon: LucideGlyph
  active: boolean
  onPress: () => void
  /**
   * 二级子项(2026-10-20 立,对齐 web NavItem.children)。
   * web 的「模型 / 知识库 / 我的学习 / 用户」都是可展开父项,RN 此前只有一层 ——
   * 这是两端**结构**差距最大的一处(不只是条目多少)。补齐后「知识库 / 我的学习 /
   * 用户中心」与 web 同形:父项可点进、箭头就地展开、子项缩进一列。
   */
  children?: readonly NavRowModel[]
}

function NavRow({ item }: { item: NavRowModel }) {
  const { Icon, active } = item
  return (
    <Pressable
      onPress={item.onPress}
      className="h-9 flex-row items-center gap-2.5 rounded-md px-2.5"
      style={active ? styles.navRowActive : undefined}
      android_ripple={{ color: tokens.surface.muted }}
    >
      <Icon
        size={rnGeometry.glyphMd}
        color={active ? tokens.brand.ctaForeground : tokens.text.secondary}
      />
      <Text
        numberOfLines={1}
        className="flex-1 font-medium"
        style={active ? styles.navRowActiveText : styles.navRowText}
      >
        {item.label}
      </Text>
    </Pressable>
  )
}

/**
 * 可展开导航行(web ExpandableNavItem 同构,2026-10-20 立)
 *
 * - 行主体点按 = 进父项路由(与 web 父项 href 行为一致,不是只能展开);
 * - 右侧 36 命中方块切展开/收起(箭头 -90 度表收起,与折叠分组同款手势);
 * - 父项高亮 = 自身命中 **或任一子项命中**(与 web 折叠父项同口径:
 *   用户在子页时,侧栏父项必须仍是亮的,否则看不出自己在哪一组)。
 */
function NavExpandableRow({ item }: { item: NavRowModel }) {
  const [expanded, setExpanded] = useState(false)
  const { Icon, active } = item
  return (
    <View>
      <View className="flex-row items-center">
        <Pressable
          onPress={item.onPress}
          className="h-9 flex-1 flex-row items-center gap-2.5 rounded-md px-2.5"
          style={active ? styles.navRowActive : undefined}
          android_ripple={{ color: tokens.surface.muted }}
        >
          <Icon
            size={rnGeometry.glyphMd}
            color={active ? tokens.brand.ctaForeground : tokens.text.secondary}
          />
          <Text
            numberOfLines={1}
            className="flex-1 font-medium"
            style={active ? styles.navRowActiveText : styles.navRowText}
          >
            {item.label}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          className="h-9 w-9 items-center justify-center rounded-md"
          accessibilityRole="button"
          accessibilityLabel={item.label}
          android_ripple={{ color: tokens.surface.muted }}
        >
          <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
            <ChevronDown size={rnGeometry.glyphSm} color={tokens.text.tertiary} />
          </View>
        </Pressable>
      </View>
      {expanded && item.children ? (
        <View className="pl-3">
          {item.children.map((child) => (
            <NavRow key={child.key} item={child} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

// ── 域入口行(P3 侧边栏收敛:教育/内容/交易/社区收进 DomainHubScreen 二级屏) ──
interface NavDomainRowProps {
  label: string
  Icon: HubGlyph
  onPress: () => void
}

function NavDomainRow({ label, Icon, onPress }: NavDomainRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="h-9 flex-row items-center gap-2.5 rounded-md px-2.5"
      android_ripple={{ color: tokens.surface.muted }}
    >
      <Icon size={rnGeometry.glyphMd} color={tokens.text.secondary} />
      <Text numberOfLines={1} className="flex-1 font-medium" style={styles.navRowText}>
        {label}
      </Text>
      <ChevronRight size={rnGeometry.glyphSm} color={tokens.text.tertiary} />
    </Pressable>
  )
}

// ── 可折叠分组(web NavGroupSection 同构:text-xs uppercase 标题 + ChevronDown,折时 -90 度) ──

interface NavGroupSectionProps {
  title: string
  variant?: 'hot'
  defaultOpen: boolean
  items: readonly NavRowModel[]
}

function NavGroupSection({ title, variant, defaultOpen, items }: NavGroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultOpen)
  return (
    <View className="mt-1">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="h-8 flex-row items-center gap-1.5 rounded-md px-2.5"
        android_ripple={{ color: tokens.surface.muted }}
      >
        {variant === 'hot' ? (
          <Flame size={rnGeometry.glyphSm} color={tokens.warning.DEFAULT} />
        ) : null}
        <Text
          numberOfLines={1}
          className="flex-1 text-xs font-semibold uppercase tracking-wider"
          style={{ color: variant === 'hot' ? tokens.danger.DEFAULT : tokens.text.tertiary }}
        >
          {title}
        </Text>
        <View style={{ transform: [{ rotate: expanded ? '0deg' : '-90deg' }] }}>
          <ChevronDown size={rnGeometry.glyphSm} color={tokens.text.tertiary} />
        </View>
      </Pressable>
      {expanded ? (
        <View>
          {items.map((item) =>
            item.children && item.children.length > 0 ? (
              <NavExpandableRow key={item.key} item={item} />
            ) : (
              <NavRow key={item.key} item={item} />
            ),
          )}
        </View>
      ) : null}
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
    onCreateNewChat,
    onSelectConversation,
    onDeleteConversation,
    onOpenSettings,
    onOpenMessages,
    onClaimFree,
    onGoHome,
  } = props

  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const { logout } = useAuth()
  const { resolvedTheme, setThemeMode } = useTheme()
  const navigation = useNavigation<DrawerNav>()
  // app.json orientation 已放开为 default,旋转/分屏时抽屉宽度必须随窗口变化
  const { width: screenWidth } = useWindowDimensions()
  const drawerWidth = Math.min(screenWidth * DRAWER_WIDTH_RATIO, rnGeometry.drawerWidth)

  // progress: 0 = 隐藏, 1 = 显示
  const progress = useRef(new Animated.Value(0)).current
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  // 会话收藏乐观覆盖(id → favorited),避免 9 个屏各自接回调(2026-09-05)
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: ANIM_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [progress, visible])

  // 关闭抽屉时重置左滑状态与用户菜单
  useEffect(() => {
    if (!visible) {
      setOpenSwipeId(null)
      setUserMenuOpen(false)
    }
  }, [visible])

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth - 20, 0],
  })
  const overlayOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, OVERLAY_OPACITY],
  })

  const modelGroups = useMemo(() => {
    if (Object.keys(favOverrides).length === 0) return groupByModelAndDate(conversations)
    // 应用收藏乐观覆盖( favorited = 列表值 ⊕ 本地 override )
    const patched = conversations.map((c) =>
      c.id in favOverrides ? { ...c, favorited: favOverrides[c.id] } : c,
    )
    return groupByModelAndDate(patched)
  }, [conversations, favOverrides])

  /** 收藏切换(乐观更新,失败回滚;2026-09-05 矩阵① Chat 收藏补齐) */
  const handleToggleFavoriteConversation = useCallback(
    (id: string, next: boolean) => {
      setFavOverrides((prev) => ({ ...prev, [id]: next }))
      const call = next ? favoriteConversation(id) : unfavoriteConversation(id)
      call.catch(() => {
        setFavOverrides((prev) => {
          const { [id]: _rollback, ...rest } = prev
          return rest
        })
        appAlert(t('drawer.prompt'), t('drawer.favoriteFailed'))
      })
    },
    [t],
  )

  const handleSwipeOpen = useCallback((id: string) => {
    setOpenSwipeId((prev) => (prev === id ? prev : id))
  }, [])

  /**
   * active 判定:取根栈顶路由名;顶栈是 Main Tab 容器时取 params.screen
   * (HomeMain/CourseMain/...),与导航行 route 字段匹配。
   */
  const activeRouteName = useNavigationState((state) => {
    if (!state || state.routes.length === 0) return undefined
    // noUncheckedIndexedAccess:索引访问返回 T | undefined,须显式收窄
    const route = state.routes[state.index]
    if (!route) return undefined
    if (route.name === 'Main') {
      const params = route.params as { screen?: string } | undefined
      return params?.screen
    }
    return route.name
  })

  /** 导航行点击:drawerTab 走父级契约(由调用方 navigateDrawerTab 统一映射),其余直跳路由 */
  const handleNavTarget = useCallback(
    (target: DrawerNavTarget) => {
      if (target.type === 'drawerTab') {
        onNavigate(target.tab)
        onClose()
        return
      }
      onClose()
      if (target.type === 'main') {
        navigation.navigate('Main', { screen: target.screen })
      } else {
        // as never:navigate 重载按单一键名分派,联合键名(DrawerRouteName)匹配不了任何单一重载
        // (同 navigation-ref.ts / DistributionScreen 先例)
        navigation.navigate(target.name as never)
      }
    },
    [navigation, onClose, onNavigate],
  )

  const handleCreateNewChat = useCallback(() => {
    onCreateNewChat()
    onClose()
  }, [onCreateNewChat, onClose])

  const handleLogoPress = useCallback(() => {
    onGoHome()
    onClose()
  }, [onGoHome, onClose])

  const handleSelectConversation = (id: string) => {
    onSelectConversation(id)
    onClose()
  }

  // 登录态判定沿用 web UserRow 语义:昵称为空 = 未登录
  const isLoggedIn = Boolean(user.nickname)
  const initials = (user.nickname || t('drawer.notLoggedIn')).slice(0, 1).toUpperCase()

  /** 未登录 → Login 路由(对齐 web UserRow 登录入口) */
  const handleLoginPress = useCallback(() => {
    onClose()
    navigation.navigate('Login')
  }, [navigation, onClose])

  /** 用户菜单-退出登录:确认后登出(文案全 i18n,替代旧硬编码"确定要退出登录吗?") */
  const handleLogoutPress = useCallback(() => {
    setUserMenuOpen(false)
    appAlert(t('common.logout'), t('settings.logoutConfirm'), [
      { text: t('drawer.cancel'), style: 'cancel' },
      { text: t('drawer.exit'), style: 'destructive', onPress: () => void logout() },
    ])
  }, [logout, t])

  /**
   * 单条导航项 → 渲染模型(递归构造子项,对齐 web children)。
   * 父项 active = 自身命中 **或任一子项命中**(与 web 折叠父项同口径)。
   */
  const buildNavRow = (item: DrawerNavItem): NavRowModel => {
    const children = item.children?.map(buildNavRow)
    const selfActive = item.route !== undefined && item.route === activeRouteName
    return {
      key: item.labelKey,
      label: t(item.labelKey),
      Icon: item.Icon,
      active: selfActive || Boolean(children?.some((child) => child.active)),
      onPress: () => handleNavTarget(item.target),
      children,
    }
  }

  // 渲染态导航分组(label 就地翻译 + active 判定 + 点击闭包);清单来自 drawer-nav 单源
  const navGroups = DRAWER_NAV_GROUPS.map((group) => ({
    key: group.key,
    title: t(group.titleKey),
    variant: group.variant,
    defaultOpen: group.defaultOpen,
    items: group.items.map(buildNavRow),
  }))

  /** 首页行 / 快捷区自动化任务:同取导航单源,不在 JSX 里再写一份(§0.6 单一真相源) */
  const homeRow = buildNavRow(DRAWER_HOME_ITEM)
  const automationRow = buildNavRow(DRAWER_AUTOMATION_ITEM)

  /** 域入口:收起抽屉后进 DomainHubScreen 二级屏(教育/内容/交易/社区,条目单源见 navigation/domain-hub) */
  const handleOpenDomain = useCallback(
    (domain: DomainKey) => {
      onClose()
      navigation.navigate('DomainHub', { domain })
    },
    [navigation, onClose],
  )

  const groupByKey = new Map(navGroups.map((group) => [group.key, group]))

  // 用户菜单项(web SidebarUserRow 下拉的 RN 可达子集)
  const userMenuItems = isLoggedIn
    ? [
        {
          key: 'profile',
          labelKey: 'nav.profile',
          Icon: User,
          onPress: () => {
            setUserMenuOpen(false)
            handleNavTarget({ type: 'drawerTab', tab: 'mine' })
          },
        },
        {
          key: 'vip',
          labelKey: 'menu.vip',
          Icon: Crown,
          onPress: () => {
            setUserMenuOpen(false)
            handleNavTarget({ type: 'route', name: 'Vip' })
          },
        },
        {
          key: 'messages',
          labelKey: 'menu.messageCenter',
          Icon: Bell,
          onPress: () => {
            setUserMenuOpen(false)
            onOpenMessages()
          },
        },
        {
          key: 'settings',
          labelKey: 'menu.settings',
          Icon: Settings,
          onPress: () => {
            setUserMenuOpen(false)
            onOpenSettings()
          },
        },
        {
          // 主题切换(对齐 web SidebarUserRow 下拉里的主题项):RN 无独立主题页,
          // 直接在菜单里 light/dark 对切(ThemeContext.setThemeMode 单点生效)。
          key: 'theme',
          labelKey: 'settings.theme',
          Icon: resolvedTheme === 'dark' ? Sun : Moon,
          onPress: () => {
            setUserMenuOpen(false)
            setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')
          },
        },
        {
          key: 'claimFree',
          labelKey: 'drawer.claimFree',
          Icon: Gift,
          onPress: () => {
            setUserMenuOpen(false)
            onClaimFree?.()
          },
        },
        {
          key: 'logout',
          labelKey: 'common.logout',
          Icon: LogOut,
          onPress: handleLogoutPress,
        },
      ]
    : []

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
            className="flex-1"
            style={{
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              // 抽屉本体 = 角色档 panel(RADIUS_ROLES 注释明文含"抽屉")→ xl(12);
              // 两端此前都取 2xl(16),一致但都偏档 —— 门 128 的"仅一侧"维看不见同错,由门 150 的角色档判据指出。
              borderTopRightRadius: rnRadiusFor.panel,
              borderBottomRightRadius: rnRadiusFor.panel,
              backgroundColor: tokens.surface.card,
            }}
          >
            {/* 1. Header:logo(点击回首页)+ PanelLeftRounded 收拢钮(web SidebarHeader 同构) */}
            <View className="flex-row items-center justify-between px-2 py-1">
              <Pressable
                onPress={handleLogoPress}
                className="h-9 w-9 items-center justify-center rounded-md"
                android_ripple={{ color: tokens.surface.muted }}
              >
                <Image
                  source={resolvedTheme === 'dark' ? LOGO_DARK : LOGO_LIGHT}
                  style={styles.headerLogo}
                />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="h-9 w-9 items-center justify-center rounded-md"
                android_ripple={{ color: tokens.surface.muted }}
              >
                {/* 收拢键图标(2026-10-15 用户定):与 web 端侧边栏拉出态同款的
                    PanelLeftRounded(箭头朝左 = 收拢方向);墨迹 text.medium 对齐 web text-foreground/80 */}
                <PanelLeftRounded size={rnGeometry.glyphMd} color={tokens.text.medium} />
              </Pressable>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="px-2 pb-2">
                {/* 2. 快捷区:「新建任务」灰底行(web BTN_NEW_CONVERSATION 同构) */}
                <Pressable
                  onPress={handleCreateNewChat}
                  className="h-9 flex-row items-center gap-2.5 rounded-md px-2.5"
                  style={{ backgroundColor: tokens.surface.muted }}
                  android_ripple={{ color: tokens.surface.muted }}
                >
                  <Plus size={rnGeometry.glyphMd} color={tokens.text.primary} />
                  <Text
                    numberOfLines={1}
                    className="flex-1 font-medium"
                    style={{ color: tokens.text.primary, fontSize: rnGeometry.textBody }}
                  >
                    {t('drawer.newChat')}
                  </Text>
                </Pressable>

                {/* 2b. 自动化任务(对齐 web 侧边栏快捷区第 3 枚 /self-media/automation) */}
                <View className="mt-1">
                  <NavRow item={automationRow} />
                </View>

                {/* 3. 历史对话(模型分组 → 日期分组 → 左滑收藏/删除;机制原样,文案 i18n 化)。
                    位置对齐 web:快捷区 → 历史对话 → 分组导航 —— 此前 RN 把历史压在
                    分组之下,是两端观感差异最大的一处 */}
                <View className="mt-3 flex-row items-center justify-between px-2.5">
                  <Text
                    className="font-bold"
                    style={{ color: tokens.text.primary, fontSize: rnGeometry.textStrong }}
                  >
                    {t('drawer.history')}
                  </Text>
                  <Text style={{ color: tokens.text.tertiary, fontSize: rnGeometry.textCaption }}>
                    {t('drawer.swipeHint')}
                  </Text>
                </View>

                {modelGroups.length === 0 ? (
                  <View className="items-center px-2.5 py-8">
                    <Text style={{ color: tokens.text.tertiary, fontSize: rnGeometry.textLabel }}>
                      {t('drawer.noHistory')}
                    </Text>
                  </View>
                ) : (
                  modelGroups.map((mg) => (
                    <View key={mg.modelName} className="mt-2">
                      {/* 模型标题 */}
                      <View className="flex-row items-center gap-1.5 px-2.5 py-1">
                        {mg.modelIcon ? (
                          <Image source={{ uri: mg.modelIcon }} style={styles.modelIcon} />
                        ) : (
                          <View style={[styles.modelIcon, styles.modelIconFallback]}>
                            <Bot size={rnGeometry.glyphSm} color={tokens.text.secondary} />
                          </View>
                        )}
                        <Text
                          numberOfLines={1}
                          className="flex-1 font-semibold"
                          style={{ color: tokens.text.secondary, fontSize: rnGeometry.textLabel }}
                        >
                          {mg.modelName === DEFAULT_MODEL_NAME
                            ? t('drawer.defaultModel')
                            : mg.modelName}
                        </Text>
                      </View>
                      {/* 日期分组(今天/昨天/更早) */}
                      {mg.dateGroups.map((dg) => (
                        <View key={dg.bucket}>
                          <Text
                            className="px-2.5 py-1"
                            style={{
                              color: tokens.text.tertiary,
                              fontSize: rnGeometry.textCaption,
                            }}
                          >
                            {t(`drawer.${dg.bucket}`)}
                          </Text>
                          {dg.list.map((item) => (
                            <SwipeableConversationItem
                              key={item.id}
                              item={item}
                              isOpen={openSwipeId === item.id}
                              onOpen={handleSwipeOpen}
                              onSelect={handleSelectConversation}
                              onDelete={onDeleteConversation}
                              onToggleFavorite={handleToggleFavoriteConversation}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                  ))
                )}

                {/* 4. 首页行(无标题组,对齐 web 侧边栏首个 Home 行);条目取自导航单源 */}
                <View className="mt-2">
                  <NavRow item={homeRow} />
                </View>

                {/* 5. 竖排导航:折叠组(热门/AI/个人/推广/高级工具/开发者) + 域入口行(教育/内容/交易/社区 → 二级屏) */}
                {DRAWER_NAV_SECTIONS.map((section) => {
                  if (section.kind === 'domain') {
                    const hub = DOMAIN_HUBS[section.domain]
                    if (!hub) return null
                    return (
                      <NavDomainRow
                        key={section.domain}
                        label={t(hub.titleKey)}
                        Icon={hub.Icon}
                        onPress={() => handleOpenDomain(section.domain)}
                      />
                    )
                  }
                  const group = groupByKey.get(section.key)
                  if (!group) return null
                  return (
                    <NavGroupSection
                      key={group.key}
                      title={group.title}
                      variant={group.variant}
                      defaultOpen={group.defaultOpen}
                      items={group.items}
                    />
                  )
                })}
              </View>
            </ScrollView>

            {/* 6. 底部 UserRow(web SidebarUserRow 同构):头像 24 + 昵称,点击上浮菜单。
                2026-10-21 与 web 同步:上下对称 8px;底色继续继承抽屉的 surface.card(同源)。 */}
            <View className="shrink-0 px-2 py-2">
              <Pressable
                onPress={isLoggedIn ? () => setUserMenuOpen((v) => !v) : handleLoginPress}
                className="h-9 flex-row items-center gap-2.5 rounded-md px-2.5"
                android_ripple={{ color: tokens.surface.muted }}
              >
                {isLoggedIn ? (
                  user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                  ) : (
                    <View style={[styles.userAvatar, styles.userAvatarFallback]}>
                      <Text style={styles.userAvatarInitials}>{initials}</Text>
                    </View>
                  )
                ) : (
                  <LogIn size={rnGeometry.glyphMd} color={tokens.text.secondary} />
                )}
                <Text
                  numberOfLines={1}
                  className="flex-1"
                  style={{ color: tokens.text.secondary, fontSize: rnGeometry.textBody }}
                >
                  {isLoggedIn ? user.nickname : t('common.login')}
                </Text>
              </Pressable>
            </View>

            {/* 7. 用户菜单浮层(点空白收起;下拉容器取角色档 card=8) */}
            {userMenuOpen ? (
              <>
                <Pressable style={styles.menuScrim} onPress={() => setUserMenuOpen(false)} />
                <View
                  style={[styles.userMenu, { bottom: insets.bottom + USER_MENU_BOTTOM_OFFSET }]}
                >
                  {userMenuItems.map(({ key, labelKey, Icon, onPress }) => (
                    <Pressable
                      key={key}
                      onPress={onPress}
                      className="h-9 flex-row items-center gap-2.5 rounded-md px-2.5"
                      android_ripple={{ color: tokens.surface.muted }}
                    >
                      <Icon size={rnGeometry.glyphSm} color={tokens.text.secondary} />
                      <Text
                        numberOfLines={1}
                        className="flex-1"
                        style={{ color: tokens.text.secondary, fontSize: rnGeometry.textBody }}
                      >
                        {t(labelKey)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  // active 行品牌实底与配对前景(守门 83 R3/R4 成文形态:底/字拆兄弟 key 且名字同核心
  // navRowActive ↔ navRowActiveText,前景取 brand.ctaForeground 配对档,内联不参与配对判定)
  navRowActive: {
    backgroundColor: tokens.brand.cta,
  },
  navRowActiveText: {
    color: tokens.brand.ctaForeground,
    fontSize: rnGeometry.textBody,
  },
  navRowText: {
    color: tokens.text.secondary,
    fontSize: rnGeometry.textBody,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    // 底色只取纯黑档,不透明度由 OVERLAY_OPACITY(= --color-black-40 的 0.4)单点携带;
    // 旧写法 rgba(0,0,0,0.5) × 动画 0.5 叠加出 0.25 的实际观感,与小程序 0.4 反极,已收口。
    backgroundColor: tokens.gray.black,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: tokens.surface.card,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 0 },
    elevation: 8,
  },
  headerLogo: {
    width: HEADER_LOGO_SIZE,
    height: HEADER_LOGO_SIZE,
  },
  modelIcon: {
    width: rnGeometry.glyphSm,
    height: rnGeometry.glyphSm,
    borderRadius: rnRadiusFor.control,
  },
  modelIconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  userAvatar: {
    width: USER_AVATAR_SIZE,
    height: USER_AVATAR_SIZE,
    // 抽屉头部头像:与小程序端 `DrawerComponent.tsx` 的头像同档(2xl=16,取 RADIUS_STEPS,
    // 不写 px 字面量)。原写 `rnRadiusFor.chip`(md=6)是"导航项/chip"那一档,与小程序端
    // 同一枚元素差两档 ⇒ 守门 128 的 RD 维实测为"圆角 3 > 锚点 2"那一笔红的来源。
    // 定档依据:仓内头像族(UserInfoCard 两端)逐档同值取 2xl,本端照抄同一档而不是各取直觉。
    borderRadius: rnRadius['2xl'],
  },
  userAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  userAvatarInitials: {
    fontSize: rnGeometry.textLabel,
    fontWeight: '600',
    color: tokens.text.secondary,
  },
  menuScrim: {
    ...StyleSheet.absoluteFill,
  },
  userMenu: {
    position: 'absolute',
    left: 8,
    right: 8,
    // 下拉菜单容器:角色档 card(§3.1"下拉"定在 card,2026-09-27 用户定档卡片一律此档)
    borderRadius: rnRadiusFor.card,
    backgroundColor: tokens.surface.card,
    paddingVertical: rnSpacing.xs,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
})

export default Drawer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
