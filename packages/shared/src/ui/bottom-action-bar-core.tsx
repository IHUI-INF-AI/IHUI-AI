// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BottomActionBar(底部操作栏)的**平台无关组件核心** —— O02 票④(2026-10-25),
 * 形态照抄 `back-chevron-core.tsx`:「一份与平台无关的组件源 + 每端注入 primitive adapter」
 * (AGENTS §4;2026-09-22 的单向适配器已因「同名 ≠ 同契约」删掉 4,662 行,不要再试第二条路)。
 *
 * 本核心拥有(改一处、两端自动生效的那一层):
 *  - 条内行(chip 行 / 图标卡行 / 模型提示行)的结构与行衬 —— `bottomActionBarInlineRowBoxStyle`;
 *  - 图标卡行的卡盒/图文距/标文字号 —— `bottomActionBarIconCardBoxStyle` + 卡盒使用
 *    `BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX` / `BOTTOM_ACTION_BAR_ICON_GLYPH_PX`;
 *  - 附件/发送键的结构(方块 + 居中字形 + 无障碍角色 + 按压/禁用通道);
 *  - 动作语义留调用方:`onActivate` 由各端调用点持有(发送 / 附件 / 图标卡点击)。
 *
 * 为什么控件几何(方块边长/墨迹边长)由调用方以**逻辑 px**传进来而不是在核心里查表:
 * 本族的方块与墨迹在小程序端是"附件 14 / 发送 16 同盒 32"、RN 端是"发送 16 同盒 32",
 * 两个端本来就各自从 `bottom-action-bar-spec` 取这两枚常量。核心里再查一次表等于让
 * 两端壳的取数口消失,守门 128 的读数会把"同一枚档两端都在用"读成"只剩一端在用 32/16"
 * —— 判据看不见核心里那一次取数,给的就是一张假分叉账单。档源仍是 spec 一份,
 * 核心只负责把它换算成盒几何与字形边长。
 *
 * 平台原语由两端 adapter 注入。本文件**禁止 import 'react-native' / '@tarojs/*'** ——
 * 共享核心里出现平台件,小程序与 RN 的 tsc 就会有一端把它拉进被检程序(根桶事故同型):
 *  - 盒子视图 `View`:小程序 = @tarojs/components View(CSS 长度串);RN = react-native View(dp 数)。
 *  - 文本 `Text`:图标卡行标文字号由核心供出,颜色由调用方供出。
 *  - 可按压容器 `Pressable`:RN = react-native Pressable(pressed 只能经 children render prop
 *    落到子 View 的**数组**样式上 —— 函数形态 style 会被 cssInterop 静默吃掉,守门 131
 *    立项那一型);小程序 = Taro View(onClick + 静态 hoverClass)。
 *    盒子视图的合成留在原语里:`active` / `disabled` 的表达通道是平台事实。
 *  - 图标字形 `Glyph`:两端各自把 lucide 字形名映射到本端载体(RN lucide-react-native /
 *    小程序 LineIcon),核心只传字形名与墨迹边长。
 *  - 单位换算 `toUnit` / `glyphUnit`:RN dp 恒等;小程序盒走 rpx 串、墨迹走 rpx 数。
 *
 * 接线形状(两端壳走本核心 + 原语经注入)由
 * `packages/shared/src/ui/__tests__/bottom-action-bar-wiring.test.ts` 钉住。
 */
import type { ComponentType, ReactNode } from 'react'

import {
  BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX,
  BOTTOM_ACTION_BAR_ICON_GLYPH_PX,
  bottomActionBarIconCardBoxStyle,
  bottomActionBarInlineRowBoxStyle,
  type BottomActionBarBox,
  type BottomActionBarUnit,
} from './bottom-action-bar-spec'

/** 图标字形原语的入参(字形名 + 墨迹边长 + 图标色)。两端都收**数值**:RN dp / 小程序 rpx 数。 */
export interface BottomActionBarGlyphProps {
  name: string
  size: number
  color?: string
}

/** 盒子视图原语:两端都可接收共享核心供出的盒几何 + 调用方样式。 */
export interface BottomActionBarViewProps<U extends string | number, S> {
  className?: string
  style?: S
  boxStyle?: BottomActionBarBox<U>
  children: ReactNode
}

/** 文本原语:字号由核心供出(单位已换算),颜色由调用方供出。 */
export interface BottomActionBarTextProps<U extends string | number, S> {
  className?: string
  style?: S
  fontSize?: U
  color?: string
  children: ReactNode
}

/**
 * 可按压容器原语的入参。盒子视图的合成(几何 → 按选态 → 禁用态 → 调用方样式)住在平台原语里,
 * 理由见文件头注(RN 的 pressed 只能落到子 View 数组样式;小程序只有静态 hoverClass)。
 *
 * `E` = 该端原生事件类型(RN `GestureResponderEvent` / 小程序 `ITouchEvent`)。
 */
export interface BottomActionBarPressableProps<U extends string | number, S, E> {
  /** 无障碍名称(未传时该端不落无障碍属性 —— 旧调用点没有这个词条,不得凭空造文案) */
  accessibilityLabel?: string
  /** 激活动作(调用方语义);该端未接线时为 undefined */
  onActivate?: (event: E) => void
  /** 禁用态(小程序端此前无禁用通道,原语可忽略) */
  disabled?: boolean
  /** 选中态(图标卡的语音卡);样式由 `activeStyle` 供出,原语只决定何时压栈 */
  active?: boolean
  /** 小程序端定位/样式类名(RN 无此通道,忽略) */
  className?: string
  /** 盒几何(单位已由 `toUnit` 换算) */
  boxStyle: BottomActionBarBox<U>
  /** 调用方附加样式(压在盒几何之上) */
  style?: S
  /** 选中态样式(仅当 `active` 为 true 时压栈) */
  activeStyle?: S
  /** 禁用态样式(仅当 `disabled` 为 true 时压栈) */
  disabledStyle?: S
  children: ReactNode
}

/** 每端注入的平台原语集。`U` = 盒子几何的单位类型(RN number / 小程序 string)。 */
export interface BottomActionBarPlatform<U extends string | number, S, E> {
  /** 逻辑 px → 盒子几何的平台单位(RN:恒等 dp;小程序:rpx 串) */
  toUnit: BottomActionBarUnit<U>
  /** 逻辑 px → 图标墨迹的平台单位**数值**(RN:dp;小程序:rpx 数) */
  glyphUnit: (px: number) => number
  View: ComponentType<BottomActionBarViewProps<U, S>>
  Text: ComponentType<BottomActionBarTextProps<U, S>>
  Pressable: ComponentType<BottomActionBarPressableProps<U, S, E>>
  Glyph: ComponentType<BottomActionBarGlyphProps>
}

/** 条内行容器:chip 行 / 图标卡行 / 模型提示行共用(三行收编前的行衬本来就是同一串值)。 */
export interface BottomActionBarInlineRowProps<U extends string | number, S, E> {
  platform: BottomActionBarPlatform<U, S, E>
  className?: string
  style?: S
  children: ReactNode
}

export function BottomActionBarInlineRow<U extends string | number, S, E>({
  platform,
  className,
  style,
  children,
}: BottomActionBarInlineRowProps<U, S, E>) {
  return (
    <platform.View
      className={className}
      style={style}
      boxStyle={bottomActionBarInlineRowBoxStyle(platform.toUnit)}
    >
      {children}
    </platform.View>
  )
}

/** 图标卡项:字形名逐条与 RN 端 `ICON_GROUP_ITEMS` / 语音钮同名字形(lucide 原名)。 */
export interface BottomActionBarIconCardItem {
  key: string
  label: string
  glyph: string
  active?: boolean
}

export interface BottomActionBarIconCardRowProps<U extends string | number, S, E> {
  platform: BottomActionBarPlatform<U, S, E>
  items: ReadonlyArray<BottomActionBarIconCardItem>
  /** 行容器类名(小程序端 `flex` / `flex justify-between`) */
  className?: string
  /** 卡盒类名(小程序端 `flex flex-col items-center justify-center`) */
  cardClassName?: string
  /** 卡盒样式(底色/圆角/描边 —— 端内 token,不进核心) */
  cardStyle?: S
  /** 选中态卡盒样式(压在 `cardStyle` 之上) */
  activeCardStyle?: S
  glyphColor: string
  activeGlyphColor?: string
  labelColor: string
  activeLabelColor?: string
  onActivate?: (item: BottomActionBarIconCardItem, event: E) => void
}

/**
 * 图标卡行 —— 该结构目前只由小程序端消费(RN 的同一功能是共享 AddPanel 面板,另一种媒介),
 * 放在核心是为了让卡盒几何不落在端内壳:与 spec 里那几枚【B 单端档】同口径,
 * 不是把它粉饰成两端同构。
 */
export function BottomActionBarIconCardRow<U extends string | number, S, E>({
  platform,
  items,
  className,
  cardClassName,
  cardStyle,
  activeCardStyle,
  glyphColor,
  activeGlyphColor,
  labelColor,
  activeLabelColor,
  onActivate,
}: BottomActionBarIconCardRowProps<U, S, E>) {
  return (
    <platform.View
      className={className}
      boxStyle={bottomActionBarInlineRowBoxStyle(platform.toUnit)}
    >
      {items.map((item) => {
        const active = item.active === true
        return (
          <platform.Pressable
            key={item.key}
            accessibilityLabel={item.label}
            onActivate={(event: E) => onActivate?.(item, event)}
            active={active}
            className={cardClassName}
            boxStyle={bottomActionBarIconCardBoxStyle(platform.toUnit)}
            style={cardStyle}
            activeStyle={activeCardStyle}
          >
            <platform.Glyph
              name={item.glyph}
              size={platform.glyphUnit(BOTTOM_ACTION_BAR_ICON_GLYPH_PX)}
              color={active ? (activeGlyphColor ?? glyphColor) : glyphColor}
            />
            <platform.Text
              fontSize={platform.toUnit(BOTTOM_ACTION_BAR_ICON_CARD_LABEL_PX)}
              color={active ? (activeLabelColor ?? labelColor) : labelColor}
            >
              {item.label}
            </platform.Text>
          </platform.Pressable>
        )
      })}
    </platform.View>
  )
}

export interface BottomActionBarControlProps<U extends string | number, S, E> {
  platform: BottomActionBarPlatform<U, S, E>
  /** 方块边长(逻辑 px;档源 `BOTTOM_ACTION_BAR_CONTROL_BOX_PX`) */
  boxPx: number
  /** 墨迹边长(逻辑 px;档源 `BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX` / `..._SEND_GLYPH_PX`) */
  glyphPx: number
  /** 字形名(RN 端 loading 时传 'square' —— 停止语义,与 web 发送簇同形) */
  glyph: string
  glyphColor?: string
  /** 无障碍名称(未传则两端都不落该属性) */
  label?: string
  onActivate?: (event: E) => void
  disabled?: boolean
  className?: string
  /** 端内盒样式(底色/圆角/居中 —— 端内 token,不进核心) */
  style?: S
  /** 禁用态样式(端内 `opacity` 档) */
  disabledStyle?: S
}

/**
 * 附件「+」/ 发送键 —— 两端同一元素:等边方块 + 居中矢量字形 + button 角色。
 * 收编前两端各写一份同样的结构(小程序 Taro View + hoverClass / RN Pressable + StyleSheet),
 * 几何都来自同一张 spec 表,只有"方块怎么画"是端内事实。
 */
export function BottomActionBarControl<U extends string | number, S, E>({
  platform,
  boxPx,
  glyphPx,
  glyph,
  glyphColor,
  label,
  onActivate,
  disabled,
  className,
  style,
  disabledStyle,
}: BottomActionBarControlProps<U, S, E>) {
  return (
    <platform.Pressable
      accessibilityLabel={label}
      onActivate={onActivate}
      disabled={disabled}
      className={className}
      boxStyle={{ width: platform.toUnit(boxPx), height: platform.toUnit(boxPx) }}
      style={style}
      disabledStyle={disabledStyle}
    >
      <platform.Glyph name={glyph} size={platform.glyphUnit(glyphPx)} color={glyphColor} />
    </platform.Pressable>
  )
}
