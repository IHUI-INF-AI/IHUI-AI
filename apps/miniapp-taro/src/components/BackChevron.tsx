// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { View, type ITouchEvent } from '@tarojs/components'
import { taroGeometry } from '@ihui/design-tokens'
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

/**
 * 图标墨迹与按钮方块**不在本文件取数** —— 档位唯一真相源是
 * `packages/design-tokens/src/geometry.js`,这里只取它的 rpx 投影。
 * 之前本地写 `ICON_SIZE = 40` / `BOX_SIZE = 72`,RN 侧写 22 / 36,两句注释都自称
 * "与 web 同档"而屏幕上差 2px —— 端内既定档就是第二份真相(守门 128 立项读数 174 处)。
 */
const ICON_SIZE = taroGeometry.glyphMd
const BOX_SIZE = taroGeometry.tapBox

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
