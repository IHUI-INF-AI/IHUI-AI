// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { View, type ITouchEvent } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useTt } from '@/i18n'
import { rpx } from '@/utils/rpx'

/**
 * 页头返回键的唯一实现(小程序端)。
 *
 * 对齐 web 端 apps/web/src/components/layout/GlobalTopBar.tsx 的 TopBarBackButton:
 * 返回 affordance 只用矢量箭头(ChevronLeft / chevron-left)+ 无障碍名称,
 * 不得把「返回」两个字或 ‹ 字符当图标渲染 —— 后者与正文没有共用度量,
 * 且每页各写一份就长成"手机上和 web 不一样"(AGENTS.md §4 图标统一)。
 *
 * 平台特有:依赖 @tarojs/components 与 rpx 换算,不进 packages/ 共享层。
 */

/** 图标墨迹边长(rpx),取端内既定档 pkg-about/about/index.tsx 的同值 */
const ICON_SIZE = 40
/**
 * 按钮方块 72rpx = 36px,与 web 端顶栏返回键同档
 * (GlobalTopBar 的 TOPBAR_BTN_W9 + h-9 = 36×36 正方形)。方块即命中区,
 * 不用负 margin 造第二种几何 —— 那会让每个页面的返回键宽度各不相同。
 */
const BOX_SIZE = 72

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
    <View
      className={className}
      ariaRole="button"
      ariaLabel={tt('common.back', '返回')}
      onClick={onTap}
      hoverClass="opacity-60"
      style={{
        width: rpx(BOX_SIZE),
        height: rpx(BOX_SIZE),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <LineIcon name="chevron-left" size={ICON_SIZE} color={color} />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
