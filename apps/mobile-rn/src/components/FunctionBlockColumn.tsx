/**
 * FunctionBlockColumn 功能块列 (mobile-rn 端)
 *
 * 对齐历史项目 FunctionBlockColumn/index.vue(分销 / 工具入口卡片列):
 * - 卡片 = 图标 + 标题 + 描述
 * - 卡片:浅色 surface.light 底,padding 14,borderRadius 12
 * - 点击卡片 → onBlockPress(id)
 * - 原版为「双列」卡片布局(内置 4 分销入口 + navigateTo);RN 端分销项已外移为 props,
 *   跳转由调用方 onBlockPress 处理。新增可选 columns 还原双列网格布局(缺省 1 保持单列兼容)。
 * - 浅色优雅风,无霓虹无渐变,无分割线
 *
 * 任务规格:
 *   interface FunctionBlock { id: string; title: string; icon?: string; description?: string }
 *   interface FunctionBlockColumnProps { blocks: FunctionBlock[]; onBlockPress?: (id: string) => void; columns?: number }
 */
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { rnLightTokens as tk } from '@ihui/design-tokens'

export interface FunctionBlock {
  id: string
  title: string
  icon?: string
  description?: string
}

export interface FunctionBlockColumnProps {
  blocks: FunctionBlock[]
  onBlockPress?: (id: string) => void
  /** 列数:1 单列(默认,兼容现有调用);2 双列(对齐原版双列分销卡片) */
  columns?: number
}

const CARD_RADIUS = 12
const CARD_PADDING = 14
const BLOCK_GAP = 10
const ICON_SIZE = 44
const ICON_RADIUS = 8
const ICON_FONT_SIZE = 22
const ICON_MARGIN_RIGHT = 12
const TITLE_FONT_SIZE = 15
const DESC_FONT_SIZE = 12

const DEFAULT_ICON = '★'

export function FunctionBlockColumn({
  blocks,
  onBlockPress,
  columns = 1,
}: FunctionBlockColumnProps) {
  const isGrid = columns > 1
  // 双列(及以上)网格宽度:100/列数 再留 1% 间隔,配合 space-between 分布
  const gridCardWidth = `${100 / columns - 1}%` as `${number}%`

  return (
    <View style={isGrid ? styles.gridContainer : styles.container}>
      {blocks.map((block) => (
        <TouchableOpacity
          key={block.id}
          activeOpacity={0.8}
          onPress={() => onBlockPress?.(block.id)}
          style={isGrid ? [styles.card, styles.gridCard, { width: gridCardWidth }] : styles.card}
          accessibilityRole="button"
          accessibilityLabel={block.title}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.iconText} allowFontScaling={false}>
              {block.icon ?? DEFAULT_ICON}
            </Text>
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {block.title}
            </Text>
            {block.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {block.description}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: BLOCK_GAP,
  } as ViewStyle,
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  } as ViewStyle,
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tk.surface.light,
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
  } as ViewStyle,
  gridCard: {
    marginBottom: BLOCK_GAP,
  } as ViewStyle,
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_RADIUS,
    backgroundColor: tk.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ICON_MARGIN_RIGHT,
  } as ViewStyle,
  iconText: {
    fontSize: ICON_FONT_SIZE,
  } as TextStyle,
  textWrap: {
    flex: 1,
  } as ViewStyle,
  title: {
    fontSize: TITLE_FONT_SIZE,
    fontWeight: '600',
    color: tk.text.primary,
  } as TextStyle,
  description: {
    marginTop: 2,
    fontSize: DESC_FONT_SIZE,
    color: tk.text.secondary,
  } as TextStyle,
})

export default FunctionBlockColumn
