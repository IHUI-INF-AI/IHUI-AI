// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { View, type ITouchEvent } from '@tarojs/components'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  BackChevronCore,
  type BackChevronGlyphProps,
  type BackChevronPlatform,
  type BackChevronPressableProps,
} from '@ihui/shared/ui'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'
import { rpx } from '@/utils/rpx'

/**
 * 页头返回键的唯一实现(小程序端)—— 自 O81 票③起它是 **Taro adapter 壳**:
 * 尺寸/居中结构/按压透明度/无障碍语义住在 `@ihui/shared/ui` 的 `BackChevronCore`,
 * 本文件只注入 Taro 原语 + 挂 i18n 与默认色。
 *
 * 对齐 web 端 apps/web/src/components/layout/GlobalTopBar.tsx 的 TopBarBackButton:
 * 返回 affordance 只用矢量箭头(ChevronLeft / chevron-left)+ 无障碍名称,
 * 不得把「返回」两个字或 ‹ 字符当图标渲染 —— 后者与正文没有共用度量,
 * 且每页各写一份就长成"手机上和 web 不一样"(AGENTS.md §4 图标统一)。
 *
 * 图标墨迹与按钮方块**不在本文件取数** —— 档位唯一真相源是
 * `packages/design-tokens/src/geometry.js`,本文件只经平台对象做单位换算。
 * 壳里不得再写 `ICON_SIZE = <数字>` / `BOX_SIZE = <数字>`(守门 128 立项读数 174 处:
 * 小程序 40/72 与 RN 22/36 各写各的,两句注释都自称"与 web 同档"而屏幕上差 2px)。
 *
 * 注入的平台原语四件:
 *  - 可按压容器 = 盒子视图:@tarojs/components View 一枚(click 区即盒,与既有 DOM 同形,
 *    不引入多余包裹层)。无障碍落 ariaRole/ariaLabel,激活动作落 onClick。
 *  - 按压态:hoverClass。**类名必须是静态字面量**(模板串端内 Tailwind 生成器不产出规则),
 *    与共享源 `BACK_CHEVRON_PRESSED_OPACITY`(0.6)的对应关系由
 *    `packages/shared/src/ui/__tests__/back-chevron-wiring.test.ts` 钉住(60/100 === 0.6),
 *    不靠注释口头同值。
 *  - 图标字形:LineIcon `name="chevron-left"`(守门 102 的 S0 机制清单按该字面量判
 *    "矢量出口仍在位");size 收 rpx **数值**(它自己再按 H5/原生换算),故 glyphUnit
 *    给数、不给 rpx() 串。
 *  - 字号倍率:小程序端无系统字号缩放通道(端内既定),注入恒 1 —— 与改动前逐字同值。
 */
/// 按下态弱化类名:静态字面量,值 = BACK_CHEVRON_PRESSED_OPACITY(0.6);对应关系见 wiring 测试。
const HOVER_CLASS = 'opacity-60'

const TARO_PLATFORM: BackChevronPlatform<string, CSSProperties, ITouchEvent> = {
  /// 盒几何:逻辑 px → rpx 串(750 设计稿 2 倍换算只在这一处发生)
  toUnit: (px) => rpx(px * TARO_RPX_PER_PX),
  /// 墨迹:逻辑 px → rpx 数(LineIcon 的 size 收数值)
  glyphUnit: (px) => px * TARO_RPX_PER_PX,
  useFontMultiplier: () => 1,
  Pressable: function TaroPressable({
    onActivate,
    accessibilityLabel,
    className,
    boxStyle,
    style,
    children,
  }: BackChevronPressableProps<string, CSSProperties, ITouchEvent>) {
    return (
      <View
        className={className}
        ariaRole="button"
        ariaLabel={accessibilityLabel}
        onClick={onActivate}
        hoverClass={HOVER_CLASS}
        style={{ ...boxStyle, ...style }}
      >
        {children}
      </View>
    )
  },
  Glyph: function TaroGlyph({ size, color }: BackChevronGlyphProps) {
    return <LineIcon name="chevron-left" size={size} color={color} />
  },
}

export interface BackChevronProps {
  /** 返回动作;各页语义不同(navigateBack / switchTab / 回登录页),由调用方持有 */
  onTap?: (event: ITouchEvent) => void
  /** 仅用于定位(如导航栏里的 absolute + left/top),不得用来改字号或方块尺寸 */
  className?: string
  /**
   * 图标色。**页面头部一律留空**取默认档;仅导航栏 chrome 需跟随调用方自定义
   * textColor 时传(NavBar 的 bgColor/textColor 是端内既定入参)。
   */
  color?: string
  style?: CSSProperties
}

export default function BackChevron({
  onTap,
  className,
  color = 'var(--color-foreground)',
  style,
}: BackChevronProps) {
  const tt = useTt()
  return (
    <BackChevronCore
      platform={TARO_PLATFORM}
      onPress={onTap}
      label={tt('common.back', '返回')}
      glyphColor={color}
      className={className}
      style={style}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
