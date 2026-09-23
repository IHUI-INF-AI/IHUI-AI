// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius } from '@ihui/design-tokens'
import type { CategoryItem, ColorSchemeName } from './types'

export interface CategoryInlineBarProps {
  /** 选项(必填,空数组渲染 null,占位归调用方) */
  items: readonly CategoryItem[]
  /** 当前选中 id(必填,可为 null 表示全未选) */
  selectedId: string | null
  /** 选中回调(必填) */
  onSelect: (id: string) => void
  /** 配色(选填,默认 light,由调用方注入主题) */
  colorScheme?: ColorSchemeName
  /** 条内容左右 padding(选填,默认 12) */
  contentPaddingHorizontal?: number
  /** 项间距(选填,默认 8) */
  itemGap?: number
  /** 容器外层样式(选填) */
  style?: StyleProp<ViewStyle>
  /** 测试标识(选填) */
  testID?: string
}

/** 计数徽章(确定性居中模板:任意位数水平垂直居中,等宽数字不抖) */
function CountBadge({
  value,
  selected,
  styles,
  activeTextColor,
  idleTextColor,
  activeBg,
  idleBg,
}: {
  value: number
  selected: boolean
  styles: ReturnType<typeof createStyles>
  activeTextColor: string
  idleTextColor: string
  activeBg: string
  idleBg: string
}) {
  return (
    <View style={[styles.badge, { backgroundColor: selected ? activeBg : idleBg }]}>
      <Text style={[styles.badgeText, { color: selected ? activeTextColor : idleTextColor }]}>
        {value}
      </Text>
    </View>
  )
}

/**
 * 横滑分类条(形态 A):左右滑动,单选,选中自动滚入视野。
 * 视觉:高 32 / radius-md(6) / 完整描边 / 选中 ctaFill+ctaText 成对,无 pill/渐变/蓝光。
 */
export function CategoryInlineBar({
  items,
  selectedId,
  onSelect,
  colorScheme = 'light',
  contentPaddingHorizontal = 12,
  itemGap = 8,
  style,
  testID,
}: CategoryInlineBarProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<CategoryItem>>(null)

  // 只按"选中项下标"滚动:调用方多处直接内联 items={x.map(...)},数组 identity 每次
  // render 都在变。依赖数组会让 effect 每轮重跑,用户刚横滑到第 12 项,父层任意一次
  // setState(输入/加载)就把条拽回选中项 —— 故 effect 只认下标变化。
  const selectedIndex = selectedId === null ? -1 : items.findIndex((it) => it.id === selectedId)
  useEffect(() => {
    if (selectedIndex < 0) return
    try {
      listRef.current?.scrollToIndex({ index: selectedIndex, animated: true, viewPosition: 0.5 })
    } catch {
      // 未布局完成时 scrollToIndex 抛错,忽略
    }
  }, [selectedIndex])

  if (items.length === 0) return null

  const renderItem = ({ item }: ListRenderItemInfo<CategoryItem>) => {
    const active = item.id === selectedId
    const Icon = item.icon
    return (
      <Pressable
        onPress={() => onSelect(item.id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.a11yLabel ?? item.label}
        hitSlop={4}
        style={({ pressed }) => (pressed ? styles.itemPressed : null)}
      >
        {/* 容器视觉放在普通 View 上:真机 release 包实测过 Pressable 的函数式 style
            这条路径整块不生效(文字样式正常、chip 的 padding/描边/底色全丢),
            选中态因此变成"深底深字看不见"。按压反馈留在 Pressable,视觉与文字同路径。 */}
        <View style={active ? [styles.item, styles.itemActive] : styles.item}>
          {Icon ? (
            <Icon
              size={item.iconSize ?? 16}
              color={active ? tk.brand.ctaText : tk.text.secondary}
            />
          ) : item.image ? (
            <Image
              source={item.image}
              style={[
                styles.itemImage,
                item.iconSize ? { width: item.iconSize, height: item.iconSize } : null,
              ]}
              resizeMode="contain"
            />
          ) : null}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.itemText, active ? styles.itemTextActive : null]}
          >
            {item.label}
          </Text>
          {typeof item.count === 'number' ? (
            <CountBadge
              value={item.count}
              selected={active}
              styles={styles}
              activeTextColor={tk.brand.ctaFill}
              idleTextColor={tk.text.secondary}
              activeBg={tk.brand.ctaText}
              idleBg={tk.surface.muted}
            />
          ) : null}
        </View>
      </Pressable>
    )
  }

  return (
    <View style={style} testID={testID}>
      <FlatList
        ref={listRef}
        data={items as CategoryItem[]}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: contentPaddingHorizontal,
          gap: itemGap,
          alignItems: 'center',
        }}
      />
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 32,
      paddingHorizontal: 12,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      // 底色必须与"它所坐落的容器"不同档:分类条既会落在 surface.bg 页面上,
      // 也会落在弹层的 surface.card 面板上(如 FenLeiOverlay)。用 card 作底时,
      // 在 card 面板里整条 chip 与背景同色,可点性觉得"没有样式"。
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.muted,
      maxWidth: 160,
    },
    itemActive: {
      borderColor: tk.brand.ctaFill,
      backgroundColor: tk.brand.ctaFill,
    },
    itemPressed: {
      opacity: 0.7,
    },
    itemText: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      color: tk.text.secondary,
      maxWidth: 120,
    },
    itemTextActive: {
      fontWeight: '600',
      color: tk.brand.ctaText,
    },
    itemImage: {
      width: 16,
      height: 16,
    },
    badge: {
      height: 16,
      minWidth: 16,
      paddingHorizontal: 4,
      borderRadius: rnRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '600',
      lineHeight: 10,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
