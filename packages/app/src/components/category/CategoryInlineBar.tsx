// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useRef } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'
import {
  CategoryItemContent,
  categoryItemA11yLabel,
  useCategorySelectedIndex,
  useScrollCategoryIntoView,
} from './category-bar-core'
import { renderRnCategoryIcon, rnCategoryPrimitives } from './rn-primitives'
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
 * 视觉:高 32 / radius-md(6) / 完整描边 / 选中实底走 brand.cta + 文字 brand.ctaForeground 成对。
 * 描边一律不用 brand.DEFAULT —— 它在亮档就是纯黑,而项目设计里没有纯黑描边这一档;选中态的
 * 强调描边统一取 brandAccent.deep(与 AssistantScreen / StudyIndex / PlazaScreen 同一既有写法),
 * 未选中取 border.medium。无 pill/渐变/蓝光。
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

  // 选中下标与滚入视野的时序统一走核心(只认下标、不认 items 身份):
  // 调用方多处直接内联 items={x.map(...)},数组 identity 每轮都在变。依赖数组若含 items,
  // 用户刚横滑到第 12 项,父层任意一次 setState(输入/加载)就把条拽回选中项。
  const selectedIndex = useCategorySelectedIndex(items, selectedId)
  useScrollCategoryIntoView(selectedIndex, (index) => {
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 })
  })

  if (items.length === 0) return null

  const renderItem = ({ item }: ListRenderItemInfo<CategoryItem>) => {
    const active = item.id === selectedId
    return (
      <Pressable
        onPress={() => onSelect(item.id)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={categoryItemA11yLabel(item)}
        hitSlop={4}
      >
        {({ pressed }) => (
          <View
            style={[
              active ? [styles.item, styles.itemActive] : styles.item,
              pressed ? styles.itemPressed : null,
            ]}
          >
            {/* 容器视觉与按压态都挂在普通 View 上。真机 release 包实测:挂在 Pressable 的
                **函数式** style 上的东西整块不生效(css-interop 的 wrap-jsx 把函数摊成 {},
                见守门 131)—— 早先这里写 `style={({pressed}) => …}`,于是"按压反馈留在
                Pressable"只是个账面说法,手机上从来没有淡出。改走 children 函数形态:
                它是 RN 自己的 API,不经 interop 的 style 通道。 */}
            {/* 条目内容的「图标 → 图片 → 文案 → 计数」顺序由核心统一,与下拉窗同一份实现;
                这里只注入 RN 原语,不再抄第二遍结构。 */}
            <CategoryItemContent
              item={item}
              active={active}
              primitives={rnCategoryPrimitives}
              renderIcon={renderRnCategoryIcon}
              defaultIconSize={16}
              iconColor={tk.text.secondary}
              activeIconColor={tk.brand.ctaForeground}
              textStyle={styles.itemText}
              activeTextStyle={[styles.itemText, styles.itemTextActive]}
              imageStyle={styles.itemImage}
              trailing={
                typeof item.count === 'number' ? (
                  <CountBadge
                    value={item.count}
                    selected={active}
                    styles={styles}
                    activeTextColor={tk.brand.DEFAULT}
                    idleTextColor={tk.text.secondary}
                    activeBg={tk.brand.ctaForeground}
                    idleBg={tk.surface.muted}
                  />
                ) : null
              }
            />
          </View>
        )}
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
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      // 底色必须与"它所坐落的容器"不同档:分类条既会落在 surface.bg 页面上,
      // 也会落在弹层的 surface.card 面板上(如 FenLeiOverlay)。用 card 作底时,
      // 在 card 面板里整条 chip 与背景同色,可点性觉得"没有样式"。
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.muted,
      // 不写宽度上限:三端取齐 web 那份 ITEM_BASE(它既不封顶也不截断),长分类名靠横向滚动消化。
      // 单位数值刻意不写在这里 —— 门 128 的几何提取式会读注释,散文里的数字会被当成端上的档。
    },
    itemActive: {
      borderColor: tk.brandAccent.deep,
      backgroundColor: tk.brand.cta,
    },
    itemPressed: {
      opacity: 0.7,
    },
    itemText: {
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      color: tk.text.secondary,
    },
    itemTextActive: {
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    itemImage: {
      width: 16,
      height: 16,
    },
    badge: {
      height: 16,
      minWidth: 16,
      paddingHorizontal: rnSpacing.xs,
      borderRadius: rnRadius.md,
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
