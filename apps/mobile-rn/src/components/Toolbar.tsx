/**
 * Toolbar 首页内容大块 (mobile-rn 端)
 *
 * 对齐历史项目 Toolbar/index.vue 的完整首页内容结构(1:1 复刻),语义为「首页内容大块」而非按钮阵列:
 *  1. 3 服务项(流量运营陪跑 / 一站式设备应用 / AI其他技术服务)
 *  2. 栏目标题「独家开发 AI Agent应用」+「查看更多」
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
 * 配色走 web token(rnLightTokens):brand 黑 / success 绿 / warning 橙 / danger 红,禁用 purple/indigo。
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
import { rnLightTokens as tokens } from '@ihui/design-tokens'

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
  icon: string
}

/** 工具格(6 工具入口) */
export interface ToolbarTool {
  key: string
  title: string
  description: string
  icon: string
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
  /** 点击「查看更多」(原 handleToolbarTitleClick → AI工具箱) */
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
  { id: 'traffic', title: '流量运营陪跑', icon: '🚀' },
  { id: 'device', title: '一站式设备应用', icon: '📱' },
  { id: 'other', title: 'AI其他技术服务', icon: '🛠️' },
]

/** 6 工具格(对齐 secondRowList) */
const HOME_TOOLS: ToolbarTool[] = [
  { key: 'ai_image', title: 'AI图片创作', description: '轻松创作图片', icon: '🖼️' },
  { key: 'ai_video', title: 'AI视频创作', description: '轻松创作视频', icon: '🎬' },
  { key: 'ai_wenan', title: 'AI文案创作', description: '轻松创作文案', icon: '✍️' },
  { key: 'ai_clip', title: 'AI自动剪辑', description: '轻松创作剪辑', icon: '✂️' },
  { key: 'ai_live', title: 'AI直播', description: 'AI直播服务', icon: '📡' },
  { key: 'ai_avatar', title: 'AI数字人', description: '制作数字人', icon: '🧑' },
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
                <Pressable
                  onPress={item.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={item.key}
                  accessibilityState={{ selected: isActive }}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.tool,
                    isActive ? styles.toolActive : styles.toolInactive,
                    pressed && !isActive ? styles.toolPressed : null,
                  ]}
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
            style={({ pressed }) => [styles.serviceItem, pressed ? styles.pressed : null]}
          >
            <Text style={styles.serviceTitle}>{service.title}</Text>
            <Text style={styles.serviceIcon} allowFontScaling={false}>
              {service.icon}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 2. 栏目标题 + 查看更多 */}
      <Pressable
        onPress={onMorePress}
        accessibilityRole="button"
        accessibilityLabel="查看更多 AI Agent 应用"
        style={({ pressed }) => [styles.sectionTitleRow, pressed ? styles.pressed : null]}
      >
        <Text style={styles.sectionTitle}>独家开发 AI Agent应用</Text>
        <View style={styles.moreWrap}>
          <Text style={styles.moreText}>查看更多</Text>
          <Text style={styles.moreArrow} allowFontScaling={false}>
            ›
          </Text>
        </View>
      </Pressable>

      {/* 3. 营销 banner(带浮动动画) */}
      <Pressable
        onPress={onBannerPress}
        accessibilityRole="button"
        accessibilityLabel="独家一键生成运营内容"
        style={({ pressed }) => [styles.bannerWrap, pressed ? styles.pressed : null]}
      >
        <Animated.View style={[styles.bannerFloat, { transform: [{ translateY }] }]}>
          <Text style={styles.bannerFloatEmoji} allowFontScaling={false}>
            🤖
          </Text>
        </Animated.View>
        <View style={styles.bannerCard}>
          <Text style={styles.bannerTitle}>独家一键生成运营内容</Text>
          <Text style={styles.bannerSub}>批量一件生成百条爆款，降本增效90%</Text>
        </View>
      </Pressable>

      {/* 4. 6 工具格 */}
      <View style={styles.toolGrid}>
        {HOME_TOOLS.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={() => onToolPress?.(tool.key)}
            accessibilityRole="button"
            accessibilityLabel={tool.title}
            style={({ pressed }) => [styles.toolCell, pressed ? styles.pressed : null]}
          >
            <View style={styles.toolIconWrap}>
              <Text style={styles.toolIcon} allowFontScaling={false}>
                {tool.icon}
              </Text>
            </View>
            <View style={styles.toolTextWrap}>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* 5. 定制服务区块 */}
      <Pressable
        onPress={onCustomServicePress}
        accessibilityRole="button"
        accessibilityLabel="AI定制服务"
        style={({ pressed }) => [styles.customWrap, pressed ? styles.pressed : null]}
      >
        <View style={styles.customIconWrap}>
          <Text style={styles.customIcon} allowFontScaling={false}>
            🎁
          </Text>
        </View>
        <Text style={styles.customText}>AI定制服务，满足您个性化的服务需求</Text>
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
    borderRadius: 12,
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
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderRadius: 15,
    paddingVertical: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.surface.muted,
  },
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
  moreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 14,
    color: tokens.text.secondary,
  },
  moreArrow: {
    fontSize: 18,
    lineHeight: 18,
    color: tokens.text.secondary,
    marginLeft: 2,
  },

  // ── 3. 营销 banner ──
  bannerWrap: {
    position: 'relative',
    height: 100,
    paddingBottom: 10,
    marginTop: -6,
  },
  bannerFloat: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 110,
    height: 110,
    zIndex: 777,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerFloatEmoji: {
    fontSize: 64,
    lineHeight: 80,
  },
  bannerCard: {
    position: 'absolute',
    left: 0,
    top: 20,
    height: 80,
    width: '100%',
    borderRadius: 15,
    backgroundColor: tokens.brand.DEFAULT,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingLeft: 130,
    paddingRight: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.surface.light,
  },
  bannerSub: {
    fontSize: 12,
    color: tokens.gray['400'],
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
    height: 53,
    borderRadius: 27,
    marginBottom: 10,
    backgroundColor: tokens.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    borderRadius: 10,
    backgroundColor: tokens.success.light,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
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
