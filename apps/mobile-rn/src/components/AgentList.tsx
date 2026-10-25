// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentList Agent 选择列表 (mobile-rn 端)
 *
 * 对齐历史项目 components/AgentList.vue(AI 助手选择浮层):
 * - chu-box 底部弹出容器(白底圆角 7.5dp + slideUp 动画 + maxHeight 70vh 内部滚动)
 * - 行:头像(20dp 圆角 4dp)+ 名称(14dp)+ isNew 徽章(右)
 * - 选中态:黑色描边(2dp)+ 选中圆点(16dp 黑底, bounceIn 动画)
 * - 底部:加载中... / 没有更多了
 * - 行高 40dp,行间距 2.5dp,边框 2dp #B9B9B9
 * - 浅色优雅风,无霓虹/无渐变;颜色走 theme/active-tokens 的主题 token。
 * - 类型零 any,精确标注。
 *
 * 平台特有:依赖 react-native Animated/ScrollView,不适合共享层。
 */
import { useEffect, useRef } from 'react'
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { tokens } from '../theme/active-tokens'
import { rpx } from '../utils/rpx'
import { Check } from 'lucide-react-native'

import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { useI18n } from '../i18n'

/** 单个 Agent 条目(对齐 Uniapp AgentListItem 核心字段) */
export interface AgentListItem {
  id: string
  name: string
  avatar?: string
  /** 新智能体徽章(对齐 Uniapp isNew,true 时行右侧显示 new 徽章) */
  isNew?: boolean
  /** P1-3 扩展字段(与 Ai-list_b 卡片流共用契约,保留兼容) */
  description?: string
  category?: string
  type?: string
  source?: string
  isCollect?: boolean
  isThumbs?: boolean
  collectCount?: number
  likeCount?: number
  usageCount?: number
  isHot?: boolean
  userNickname?: string
  userAvatar?: string
  prologue?: string
}

export interface AgentListProps {
  items: AgentListItem[]
  onItemClick: (id: string) => void
  /** 当前选中项 id(对齐 Uniapp agentPitch) */
  selectedId?: string
  /** 加载中(对齐 Uniapp isLoading,底部显示"加载中...") */
  isLoading?: boolean
  /** 是否还有更多(对齐 Uniapp hasMore,false 且列表非空时显示"没有更多了") */
  hasMore?: boolean
  /** 空态文案 */
  emptyText?: string
  /**
   * 外层容器样式(可选)。调用方需要把列表塞进定高/弹性容器时用,
   * 典型如 `flex: 1`(否则自然高度会撑爆 sheet 的 maxHeight,压缩弹窗固定 chrome)。
   */
  style?: StyleProp<ViewStyle>
  /**
   * 行副标题字段(D114 补口,可选)。取 item[subtitleField] 渲染在 name 下方的
   * 一行小字;不传 = 不渲染副标题,行结构与既有调用方完全一致(向后兼容)。
   * 仅接受非空字符串,空串/undefined 均不渲染。
   */
  subtitleField?: 'description' | 'prologue'
}

function keyExtractor(item: AgentListItem): string {
  return item.id
}

function Row({
  item,
  selected,
  onPress,
  subtitle,
}: {
  item: AgentListItem
  selected: boolean
  onPress: () => void
  /** 副标题文案(可选,由调用方按 subtitleField 解析;不传则保持既有单行结构) */
  subtitle?: string
}): React.JSX.Element {
  const scale = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    if (!selected) {
      scale.setValue(0.3)
      return
    }
    // bounceIn 动画(对齐 Uniapp selected-icon bounceIn 0.3s ease)
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start()
  }, [selected, scale])

  return (
    <TouchableOpacity
      style={[styles.row, selected ? styles.rowActive : null]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={item.name}
    >
      <View style={styles.rowLeft}>
        <View style={styles.logoWrap}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.icon} resizeMode="cover" />
          ) : (
            <View style={[styles.icon, styles.iconFallback]}>
              <Text style={styles.iconFallbackText}>
                {item.name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        {/*
          有副标题时才把 name 包进纵向列(nameCol)以叠加一行小字;
          无副标题走既有分支,name Text 原样保留 ⇒ 既有调用方零视觉/逻辑变化。
          理由:条件包裹比对始终包裹的扰动更小 —— 不传 subtitleField 时
          DOM 结构、flex 分配(logo + text(flex:1) + badge)与原实现逐像素一致。
        */}
        {subtitle ? (
          <View style={styles.nameCol}>
            <Text style={[styles.textName, selected ? styles.textActive : null]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : (
          <Text style={[styles.text, selected ? styles.textActive : null]} numberOfLines={1}>
            {item.name}
          </Text>
        )}
        {item.isNew ? <Text style={styles.newBadge}>{'NEW'}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        {selected ? (
          <Animated.View style={[styles.selectedIcon, { transform: [{ scale }] }]}>
            <Check size={11} color={tokens.brand.ctaForeground} />
          </Animated.View>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

export default function AgentList({
  items,
  onItemClick,
  selectedId,
  isLoading = false,
  hasMore = true,
  emptyText: emptyTextProp,
  style,
  subtitleField,
}: AgentListProps): React.JSX.Element {
  const { t } = useI18n()
  const emptyText = emptyTextProp ?? t('agentList.emptyText')
  const slide = useRef(new Animated.Value(60)).current
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    // slideUp 动画(对齐 Uniapp slideUp 0.8s ease forwards)
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [slide, opacity])

  return (
    <Animated.View
      style={[styles.container, style, { opacity, transform: [{ translateY: slide }] }]}
    >
      <View style={styles.inner}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentBody}>
          {items.map((item) => {
            // 按 subtitleField 取副标题;仅非空字符串才下发(trim 过纯空白),
            // subtitleField 未传 ⇒ 恒为 undefined ⇒ Row 走既有单行分支。
            const raw = subtitleField ? item[subtitleField] : undefined
            const subtitle = typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
            return (
              <Row
                key={keyExtractor(item)}
                item={item}
                selected={selectedId === item.id}
                onPress={() => onItemClick(item.id)}
                subtitle={subtitle}
              />
            )
          })}
          {isLoading ? <Text style={styles.loadingText}>{t('common.loading')}</Text> : null}
          {!hasMore && items.length > 0 ? (
            <Text style={styles.noMoreText}>{t('order.noMore')}</Text>
          ) : null}
          {items.length === 0 && !isLoading ? (
            <Text style={styles.emptyText}>{emptyText}</Text>
          ) : null}
        </ScrollView>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  inner: {
    width: '100%',
    borderRadius: rnRadius.lg,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    maxHeight: '70%',
  },
  contentBody: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // 行高方案:定高 40 改 minHeight 40 —— 无副标题时行内容(图标 20dp)撑不满,
    // 行仍精确为 40dp,既有视觉零变化;有副标题时行自适应增高,扰动最小。
    minHeight: 40,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.surface.card,
    borderWidth: 2,
    borderColor: tokens.border.medium,
    marginVertical: 2.5,
    paddingHorizontal: 5,
  },
  rowActive: {
    borderColor: tokens.brandAccent.deep,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: rnRadius.sm,
  },
  iconFallback: {
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    fontSize: 10,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: rnType.body.size,
    marginLeft: 10,
    color: tokens.text.primary,
  },
  textActive: {
    fontWeight: '700',
  },
  // 有副标题时承载 name+subtitle 的纵向列,接管原 text 的 flex:1 水平分配
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  // nameCol 内的 name(不带 flex,避免纵向主轴上 flexGrow 干扰两行布局)
  textName: {
    fontSize: rnType.body.size,
    color: tokens.text.primary,
  },
  // 人格副标题:小字号 rpx(11)+ tertiary 色,单行截断,行距紧凑(仅 +1 marginTop)
  subtitle: {
    fontSize: rpx(11),
    color: tokens.text.tertiary,
    marginTop: 1,
  },
  newBadge: {
    fontSize: 9,
    color: tokens.surface.light,
    backgroundColor: tokens.danger.DEFAULT,
    borderRadius: rnRadius.md,
    paddingHorizontal: rnSpacing.xs,
    paddingVertical: 1,
    marginLeft: 6,
    overflow: 'hidden',
  },
  rowRight: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  selectedIcon: {
    width: 16,
    height: 16,
    borderRadius: rnRadius.lg,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconText: {
    color: tokens.brand.ctaForeground,
    fontSize: rnType.caption.size,
    fontWeight: '700',
    lineHeight: 13,
  },
  loadingText: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.text.secondary,
  },
  noMoreText: {
    textAlign: 'center',
    paddingVertical: 10,
    fontSize: 13,
    color: tokens.text.tertiary,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: rnSpacing['2xl'],
    fontSize: 13,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
