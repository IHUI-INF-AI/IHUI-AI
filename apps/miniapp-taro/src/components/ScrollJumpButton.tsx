// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { View, type ITouchEvent } from '@tarojs/components'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  ScrollJumpButtonCore,
  scrollJumpBoxStyle,
  type ScrollJumpDirection,
  type ScrollJumpGlyphProps,
  type ScrollJumpPlatform,
  type ScrollJumpPressableProps,
} from '@ihui/shared/ui'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'
import { rpx } from '@/utils/rpx'
import './ScrollJumpButton.css'

/**
 * 滚动方向浮动按钮(「返回顶部 / 跳到最新」)的小程序端唯一实现。
 *
 * 与 RN 端 `packages/app/src/components/ScrollJumpButton.tsx` 吃同一份
 * `@ihui/shared/ui`,方向语义、按压档与渲染结构都在共享核心;
 * 基准是 web 端 `chat/message-list/scroll-jump-buttons.tsx` 的
 * `Button size="icon-sm" variant="outline"`。
 *
 * 为什么不用端内 CSS 类定外观:改判前两页各写一份 —— `share/index.css` 的 `.share-toodown`
 * 是灰蓝方盒 + `↑` 字形(守门 102 GA1 字形集不含 `↑`,结构上失明所以一路活到今天),
 * `community/index.css` 的 `.community-toodown` 是 `--radius-2xl` 圆形白卡,同一语义两页两脸。
 * 类名一旦写成静态 CSS 就是第二份真相;这里只留「按下态」这一条无法内联的规则。
 *
 * 平台特有:依赖 @tarojs/components、rpx 换算与 hoverClass,由本端 adapter 注入,不进共享核心。
 */

/// 数字档在 design-tokens 的 GEOMETRY_PX,跨端结构与单位换算在 @ihui/shared/ui;本文件只做投影。
/// rpx() 是函数调用表达式,SWC 不会剥 inline rpx 字符串(见 utils/rpx 头注)。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

/**
 * 定位档的 rpx 投影再出口:页面只从本组件取数,不必第二路 import @ihui/shared/ui
 * (取数入口越多越容易有人写裸数字)。
 */
export { scrollJumpInsetRpx, pxToTaroRpx } from '@ihui/shared/ui'

/**
 * 色角色 → 本端 CSS 变量:surface=`--color-background`(web bg-background)、
 * ink=`--color-foreground`、hairline=`--color-input`(web border-input 同名同值)。
 */
const BOX_STYLE = scrollJumpBoxStyle(toUnit, {
  surface: 'var(--color-background)',
  ink: 'var(--color-foreground)',
  hairline: 'var(--color-input)',
})

/**
 * 小程序 adapter:盒子视图合成在此(含 hoverClass 与那条无法内联的按下态 CSS 变量),
 * 核心只出盒样式、按压档与方向名。图标走 LineIcon(守门 102 GA1 字形集)。
 */
const TARO_PLATFORM: ScrollJumpPlatform<CSSProperties, CSSProperties, ITouchEvent> = {
  glyphUnit: (px) => px * TARO_RPX_PER_PX,
  Pressable: function TaroPressable({
    onActivate,
    accessibilityLabel,
    className,
    boxStyle,
    pressedStyle,
    style,
    children,
  }: ScrollJumpPressableProps<CSSProperties, CSSProperties, ITouchEvent>) {
    return (
      <View
        className={`scroll-jump ${className ?? ''}`.trim()}
        ariaRole="button"
        ariaLabel={accessibilityLabel}
        onClick={onActivate}
        hoverClass="scroll-jump-pressed"
        style={{
          ...boxStyle,
          // 按下态弱化值取自共享源,经 CSS 变量喂给那条无法内联的 :hover/:active 规则
          ['--scroll-jump-pressed-opacity' as string]: String(pressedStyle.opacity),
          ...style,
        }}
      >
        {children}
      </View>
    )
  },
  Glyph: function TaroGlyph({ name, size, color }: ScrollJumpGlyphProps) {
    return <LineIcon name={name} size={size} color={color} />
  },
}

export interface ScrollJumpButtonProps {
  /** `top` = 回到顶部(chevron-up);`latest` = 跳到最新(arrow-down)。只决定方向,不决定外观。 */
  direction: ScrollJumpDirection
  onTap?: (event: ITouchEvent) => void
  /**
   * 无障碍名称的 i18n 键;默认 `common.backToTop`。可见侧是裸箭头,
   * 名称必须脱离上下文也成立,故不参与渲染、只喂 ariaLabel。
   */
  labelKey?: string
  /** 仅用于定位(贴右下偏移、给 TabBar 让位),不得用来改盒档、圆角或颜色。 */
  className?: string
  style?: CSSProperties
}

export default function ScrollJumpButton({
  direction,
  onTap,
  labelKey = 'common.backToTop',
  className,
  style,
}: ScrollJumpButtonProps) {
  const tt = useTt()
  return (
    <ScrollJumpButtonCore
      platform={TARO_PLATFORM}
      direction={direction}
      onPress={onTap}
      label={tt(labelKey, '返回顶部')}
      boxStyle={BOX_STYLE}
      glyphColor="var(--color-foreground)"
      className={className}
      style={style}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
