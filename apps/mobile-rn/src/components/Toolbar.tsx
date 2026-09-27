// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Toolbar 首页内容大块 (mobile-rn 端)
 *
 * 对齐历史项目 Toolbar/index.vue 的完整首页内容结构(1:1 复刻),语义为「首页内容大块」而非按钮阵列:
 *  1. 3 服务项(流量运营陪跑 / 一站式设备应用 / AI其他技术服务)
 *  2. 栏目标题「独家开发 AI Agent应用」+「更多」
 *  3. 营销 banner(带浮动动画 + 独家一键生成运营内容)
 *  4. 6 工具格(AI图片/视频/文案/剪辑/直播/数字人)
 *  5. 定制服务区块
 *
 * 跳转:原版 navigateTo/switchTab 全部收敛为回调 props(onServicePress / onMorePress /
 * onBannerPress / onToolPress / onCustomServicePress),由调用方 screen 接导航,组件内不 import navigation。
 *
 * 兼容:保留旧版「32×32 工具按钮阵列」props 契约(items/separators/activeKey/style),
 * 当 items 非空时在其上渲染横向工具条,确保既有调用方(HomeScreen)不破坏。
 *
 * 配色走 web token(主题 token 入口):brand 黑 / success 绿 / warning 橙 / danger 红,禁用 purple/indigo。
 * 尺寸 rpx→dp 2:1,标题 16 / 正文 14 / 辅助 12。字体已全局生效,不设 fontFamily。
 */
import { useEffect, useMemo, useRef } from 'react'
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { tokens, currentRnTheme } from '../theme/active-tokens'
import { MoreLink } from '@ihui/rn-app'
import {
  Bot,
  Film,
  Gift,
  Image as ImageIcon,
  PenLine,
  Radio,
  Rocket,
  Scissors,
  Smartphone,
  User,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native'

import { rnRadius } from '@ihui/design-tokens'

/** 旧版工具按钮项(保留契约,供既有调用方使用) */
export interface ToolbarItem {
  /** 唯一标识(用于 activeKey 匹配 + React key) */
  key: string
  /** 图标:http(s) URL / 绝对路径视为图片;其他短文本视为 emoji */
  icon: string
  /** 单项激活态(activeKey 缺省时生效) */
  active?: boolean
  /** 点击回调 */
  onPress: () => void
}

/** 服务项(顶部 3 服务) */
export interface ToolbarService {
  id: string
  title: string
  icon: LucideIcon
}

/** 工具格(6 工具入口) */
export interface ToolbarTool {
  key: string
  title: string
  description: string
  icon: LucideIcon
}

export interface ToolbarProps {
  /** 旧版 32×32 工具按钮阵列(保留兼容,传空数组可只渲染首页大块) */
  items: ToolbarItem[]
  /** 分隔条位置:在指定 key 之后插入分隔条(旧版契约) */
  separators?: string[]
  /** 全局激活 key(覆盖 items[].active)(旧版契约) */
  activeKey?: string
  /** 容器外层样式(用于页面层 flex 排版) */
  style?: StyleProp<ViewStyle>
  /** 点击顶部服务项(原 trafficApplicationServiceClick → $emit('id-service')) */
  onServicePress?: (service: ToolbarService) => void
  /** 点击「更多」(原 handleToolbarTitleClick → AI工具箱) */
  onMorePress?: () => void
  /** 点击营销 banner(原 marketingClick → AI智能营销) */
  onBannerPress?: () => void
  /** 点击工具格(原 handleItemClick,按工具 key 分发) */
  onToolPress?: (key: string) => void
  /** 点击定制服务(原 goToCustomMade) */
  onCustomServicePress?: () => void
}

/** 顶部 3 服务项(对齐 headerMenu) */
const HOME_SERVICES: ToolbarService[] = [
  { id: 'traffic', title: '流量运营陪跑', icon: Rocket },
  { id: 'device', title: '一站式设备应用', icon: Smartphone },
  { id: 'other', title: 'AI其他技术服务', icon: Wrench },
]

/** 6 工具格(对齐 secondRowList) */
const HOME_TOOLS: ToolbarTool[] = [
  { key: 'ai_image', title: 'AI图片创作', description: '轻松创作图片', icon: ImageIcon },
  { key: 'ai_video', title: 'AI视频创作', description: '轻松创作视频', icon: Film },
  { key: 'ai_wenan', title: 'AI文案创作', description: '轻松创作文案', icon: PenLine },
  { key: 'ai_clip', title: 'AI自动剪辑', description: '轻松创作剪辑', icon: Scissors },
  { key: 'ai_live', title: 'AI直播', description: 'AI直播服务', icon: Radio },
  { key: 'ai_avatar', title: 'AI数字人', description: '制作数字人', icon: User },
]

/** 判断 icon 是否为图片路径(URL / 绝对路径) */
function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

export function Toolbar({
  items,
  separators,
  activeKey,
  style,
  onServicePress,
  onMorePress,
  onBannerPress,
  onToolPress,
  onCustomServicePress,
}: ToolbarProps) {
  const separatorSet = useMemo<Set<string>>(() => new Set(separators ?? []), [separators])

  // 营销 banner 浮动动画(原 @keyframes float:translateY 0 → -20rpx,3s ease-in-out 无限)
  const float = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [float])

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] })

  return (
    <View style={[styles.root, style]}>
      {/* 旧版 32×32 工具按钮阵列(兼容既有调用方) */}
      {items.length > 0 ? (
        <View style={styles.legacyStrip}>
          {items.map((item) => {
            const isActive = activeKey !== undefined ? activeKey === item.key : item.active === true
            const showSeparator = separatorSet.has(item.key)
            return (
              <View key={item.key} style={styles.rowItem}>
                {/* 按压态不得写成「函数形态 style」挂在 Pressable 上:Pressable 注册过 cssInterop,
                    interop 对非数组声明执行「展开函数」得到空对象 ⇒ 整份内联 style 静默消失
                    (守门 131 那一型)。外框拿盒与布局,面层只拿 pressed。 */}
                <Pressable
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.key}
                  accessibilityState={{ selected: isActive }}
                  hitSlop={4}
                  style={[styles.tool, isActive ? styles.toolActive : styles.toolInactive]}
                >
                  {({ pressed }) => (
                    <View
                      style={[styles.toolFace, pressed && !isActive ? styles.toolPressed : null]}
                    >
                      {isImagePath(item.icon) ? (
                        <Image
                          source={{ uri: item.icon }}
                          style={styles.icon}
                          resizeMode="contain"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <Text style={styles.iconEmoji} allowFontScaling={false}>
                          {item.icon}
                        </Text>
                      )}
                    </View>
                  )}
                </Pressable>
                {showSeparator ? <View style={styles.separator} /> : null}
              </View>
            )
          })}
        </View>
      ) : null}

      {/* 1. 顶部 3 服务项 */}
      <View style={styles.serviceRow}>
        {HOME_SERVICES.map((service) => (
          <Pressable
            key={service.id}
            onPress={() => onServicePress?.(service)}
            accessibilityRole="button"
            accessibilityLabel={service.title}
            style={styles.serviceItem}
          >
            {({ pressed }) => (
              <View style={[styles.serviceItemFace, pressed ? styles.pressed : null]}>
                <Text style={styles.serviceTitle} numberOfLines={1}>
                  {service.title}
                </Text>
                <service.icon size={24} color={tokens.text.secondary} />
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* 2. 栏目标题 + 更多(入口委托 MoreLink,与其余区段头同规格) */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>独家开发 AI Agent应用</Text>
        <MoreLink
          label="更多"
          onPress={onMorePress}
          accessibilityLabel="查看更多 AI Agent 应用"
          colorScheme={currentRnTheme()}
        />
      </View>

      {/* 3. 营销 banner(带浮动动画) */}
      <Pressable
        onPress={onBannerPress}
        accessibilityRole="button"
        accessibilityLabel="独家一键生成运营内容"
        style={styles.bannerWrap}
      >
        {({ pressed }) => (
          <View style={[styles.bannerFace, pressed ? styles.pressed : null]}>
            <Animated.View style={[styles.bannerFloat, { transform: [{ translateY }] }]}>
              <Bot size={56} color={tokens.brandAccent.DEFAULT} />
            </Animated.View>
            <View style={styles.bannerCard}>
              <Text style={styles.bannerTitle}>独家一键生成运营内容</Text>
              <Text style={styles.bannerSub}>批量一键生成百条爆款，降本增效90%</Text>
            </View>
          </View>
        )}
      </Pressable>

      {/* 4. 6 工具格 */}
      <View style={styles.toolGrid}>
        {HOME_TOOLS.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={() => onToolPress?.(tool.key)}
            accessibilityRole="button"
            accessibilityLabel={tool.title}
            style={styles.toolCell}
          >
            {({ pressed }) => (
              <View style={[styles.rowFace, pressed ? styles.pressed : null]}>
                <View style={styles.toolIconWrap}>
                  <tool.icon size={20} color={tokens.text.secondary} />
                </View>
                <View style={styles.toolTextWrap}>
                  <Text style={styles.toolTitle} numberOfLines={1}>
                    {tool.title}
                  </Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>
                    {tool.description}
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* 5. 定制服务区块 */}
      <Pressable
        onPress={onCustomServicePress}
        accessibilityRole="button"
        accessibilityLabel="AI定制服务"
        style={styles.customWrap}
      >
        {({ pressed }) => (
          <View style={[styles.rowFace, pressed ? styles.pressed : null]}>
            <View style={styles.customIconWrap}>
              <Gift size={26} color={tokens.text.secondary} />
            </View>
            <Text style={styles.customText}>AI定制服务，满足您个性化的服务需求</Text>
          </View>
        )}
      </Pressable>
    </View>
  )
}

export default Toolbar

const styles = StyleSheet.create({
  root: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 10,
  },

  // ── 旧版 32×32 工具按钮阵列(兼容) ──
  legacyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.muted,
    borderRadius: rnRadius.xl,
    gap: 4,
    marginBottom: 10,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tool: {
    width: 32,
    height: 32,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 面层:撑满外框内容盒并承载按压态(见上方守门 131 说明)。圆角与外框同档 —— 按压底色
  // (toolPressed 是背景色而非透明度)必须画在被圆角裁出来的同一盒上,否则按压会露出方角。
  toolFace: {
    width: '100%',
    height: '100%',
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  toolInactive: {
    backgroundColor: 'transparent',
  },
  toolActive: {
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    shadowColor: tokens.gray.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  toolPressed: {
    backgroundColor: tokens.surface.card,
  },
  icon: {
    width: 18,
    height: 18,
  },
  iconEmoji: {
    fontSize: 16,
    lineHeight: 20,
    color: tokens.text.primary,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: tokens.border.medium,
    marginHorizontal: 4,
  },

  // ── 1. 3 服务项 ──
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  serviceItem: {
    width: '31%',
    height: 70,
    borderRadius: rnRadius['2xl'],
    paddingVertical: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surface.muted,
  },
  // 面层排布与外框声明同形(竖排 + 两端对齐),按压态只落在这一层。
  serviceItemFace: {
    width: '100%',
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.text.primary,
    textAlign: 'center',
  },
  serviceIcon: {
    fontSize: 24,
    lineHeight: 28,
  },

  // ── 2. 栏目标题 ──
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },

  // ── 3. 营销 banner(正常流布局;机器人列随浮动动画上浮,paddingTop 10 为浮动基线余量,上浮 -10 不出容器) ──
  bannerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
  },
  // 面层撑满外框内容盒;bannerFloat / bannerCard 都是绝对定位,其定位基准随children 一起
  // 落到这一层 —— 外框没有 paddingTop/paddingLeft,两层原点重合,像素位置逐字不变。
  bannerFace: {
    width: '100%',
    height: '100%',
  } as ViewStyle,
  bannerFloat: {
    width: 90,
    height: 90,
    marginLeft: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerFloatEmoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  bannerCard: {
    flex: 1,
    height: 80,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 12,
    paddingRight: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  bannerSub: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 4,
  },

  // ── 4. 6 工具格 ──
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  toolCell: {
    width: '48.5%',
    minHeight: 53, // 描述两行时按内容放开,不裁字;常规文案下单行保持 53
    borderRadius: 27, // radius-exempt: 工具格胶囊端≈cell 高度一半(53 基准,minHeight 按内容可放开)
    marginBottom: 10,
    backgroundColor: tokens.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19, // radius-exempt: 图标底 38×38 正圆(直径一半)
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.success.light,
  },
  toolIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  toolTextWrap: {
    marginLeft: 12,
    paddingRight: 12,
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  toolTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  toolDesc: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: 1,
  },

  // ── 5. 定制服务 ──
  customWrap: {
    width: '100%',
    height: 53,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.success.light,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  // 横排面层:toolCell 与 customWrap 共用(两者的排布声明同形,按压态只落在这一层)。
  rowFace: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  customIconWrap: {
    width: 45,
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIcon: {
    fontSize: 26,
    lineHeight: 32,
  },
  customText: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.success.deepText,
  },

  pressed: {
    opacity: 0.7,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠