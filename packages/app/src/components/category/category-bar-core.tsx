// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useRef, type ComponentType, type ReactNode } from 'react'

/**
 * 分类栏(**形态 A 横滑条** / **形态 B 下拉窗**)的平台无关组件核心。
 *
 * 立票背景(台账「RN 分类栏统一收口」):两个形态此前各自把「图标 → 图片 → 文案 → 计数/勾」
 * 的条目内容、以及「选中项滚入视野」的时序各写一遍 —— 形状相同,契约只靠注释口头维持。
 * 本文件只收「改一处、两个形态自动生效」的那一层:
 *  - 条目内容的结构与无障碍名称(`CategoryItemContent` / `categoryItemA11yLabel`);
 *  - 选中项下标的解析(`useCategorySelectedIndex`);
 *  - 选中项滚入视野的时序(`useScrollCategoryIntoView`,只认下标、不认 items 身份)。
 *
 * 平台原语(文本 / 图片 / 字形载体)由 adapter 注入。本文件**禁止 import 'react-native' /
 * '@tarojs/*'**:核心一旦拉进平台件,第二个消费端再接进来时就会被平台类型绑死 ——
 * 与 `packages/shared/src/ui/back-chevron-core.tsx` 同一条纪律。
 *
 * 几何不落本文件:档值(条目高 / 图标边长 / 字号)仍由各端 adapter 的样式表持有,
 * 核心只接收 `defaultIconSize` 这类由调用方供出的逻辑 px。守门 128 的几何维读的是配对腿
 * 文件,把数字搬进核心等于让两端壳的取数口静默消失(假分叉 / 假隐身两型都记过账)。
 */

/**
 * 条目数据的**最小公共面**:端内 `CategoryItem`(RN)可直接结构满足。
 * `icon` / `image` 保持 `unknown`,由 adapter 的字形 / 图片原语解释 ——
 * 核心不 import lucide,也不 import 任何端内图片类型。
 */
export interface CategoryCoreItem {
  id: string
  label: string
  a11yLabel?: string
  count?: number
  icon?: unknown
  image?: unknown
  /** 图标 / 图片边长(选填,默认取 adapter 的 `defaultIconSize`) */
  iconSize?: number
}

export interface CategoryTextPrimitiveProps<T> {
  style?: T
  numberOfLines?: number
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
  children?: ReactNode
}

export interface CategoryImagePrimitiveProps<I> {
  source: unknown
  style?: I
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
}

/** 每个 adapter 注入的原语集(文本 / 图片;盒子与按压容器由 adapter 自行合成)。 */
export interface CategoryContentPrimitives<T, I> {
  Text: ComponentType<CategoryTextPrimitiveProps<T>>
  Image: ComponentType<CategoryImagePrimitiveProps<I>>
}

/** 无障碍名称:调用点没给 `a11yLabel` 时复用可见文案,不拼后缀(两端同一口径)。 */
export function categoryItemA11yLabel(item: CategoryCoreItem): string {
  return item.a11yLabel ?? item.label
}

/**
 * 选中项下标。`selectedId === null` ⇒ -1(表示全未选,调用方不滚)。
 * 刻意不 memo:调用点多处直接内联 `items={x.map(...)}`,数组身份每轮都变,
 * 依赖它只会把「滚动跟 items 身份跑」这一型 bug 换个写法带回来。
 */
export function useCategorySelectedIndex(
  items: readonly CategoryCoreItem[],
  selectedId: string | null,
): number {
  return selectedId === null ? -1 : items.findIndex((it) => it.id === selectedId)
}

/**
 * 选中项滚入视野的**时序单一源**:effect 只认下标变化。
 *
 * 只认下标的理由(2026-09-23 实测):`items` 每轮 render 都是新数组,把 items 写进依赖
 * 会让用户刚横滑到第 12 项、父层任意一次 setState(输入 / 加载)就把条拽回选中项。
 * 回调经 ref 取最新值,避免把 `scrollTo` 身份写进依赖。
 * 未布局完成时 `scrollToIndex` 会抛错 —— 吞掉,不让一次过早的滚动把整条挂掉。
 */
export function useScrollCategoryIntoView(
  selectedIndex: number,
  scrollTo: (index: number) => void,
): void {
  const scrollRef = useRef(scrollTo)
  scrollRef.current = scrollTo
  useEffect(() => {
    if (selectedIndex < 0) return
    try {
      scrollRef.current(selectedIndex)
    } catch {
      // 未布局完成时 scrollToIndex 抛错,忽略
    }
  }, [selectedIndex])
}

export interface CategoryItemContentProps<T, I> {
  item: CategoryCoreItem
  active: boolean
  primitives: CategoryContentPrimitives<T, I>
  /**
   * 字形载体:把 `item.icon`(adapter 自己的图标引用)落到本端矢量组件。
   * 未注入时核心不渲染前置图标(只渲染文案与尾槽)。
   */
  renderIcon?: (icon: unknown, size: number, color: string) => ReactNode
  /** 图标 / 图片的默认边长(逻辑 px,由 adapter 供出;核心不持档) */
  defaultIconSize: number
  iconColor: string
  /** 选中态图标色(未传则沿用 `iconColor`) */
  activeIconColor?: string
  textStyle?: T
  /** 选中态文本样式(整份替换,不再与 `textStyle` 合并 —— 合并规则属于 adapter 的数组样式) */
  activeTextStyle?: T
  imageStyle?: I
  /** 尾槽:计数徽章(形态 A)/ 选中勾(形态 B),由调用方渲染 */
  trailing?: ReactNode
}

/**
 * 条目内容:前置视觉(图标优先,其次图片)→ 文案(单行截断)→ 尾槽。
 * 盒子、按压反馈、滚动容器都是端内事实,留在 adapter —— 这里只统一「条目里有什么、什么顺序」。
 */
export function CategoryItemContent<T, I>({
  item,
  active,
  primitives,
  renderIcon,
  defaultIconSize,
  iconColor,
  activeIconColor,
  textStyle,
  activeTextStyle,
  imageStyle,
  trailing,
}: CategoryItemContentProps<T, I>) {
  const size = item.iconSize ?? defaultIconSize
  const color = active ? (activeIconColor ?? iconColor) : iconColor
  const leading =
    item.icon && renderIcon ? (
      renderIcon(item.icon, size, color)
    ) : item.image ? (
      <primitives.Image
        source={item.image}
        style={item.iconSize ? ({ width: size, height: size } as I) : imageStyle}
        resizeMode="contain"
      />
    ) : null
  return (
    <>
      {leading}
      <primitives.Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={active ? (activeTextStyle ?? textStyle) : textStyle}
      >
        {item.label}
      </primitives.Text>
      {trailing}
    </>
  )
}
