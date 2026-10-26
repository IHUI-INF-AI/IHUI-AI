// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'

/**
 * 底部/顶部抽屉(Sheet)—— 与 `packages/ui-native/src/sheet.tsx` 逐契约对齐(「一模一样」契约)。
 *
 * 对齐点(API / 结构 / 视觉):
 * - `SheetProps` 同 RN:`open: boolean` / `onOpenChange?: (open: boolean) => void` / `children?: ReactNode` / `side?: 'bottom' | 'top'`(默认 'bottom')。
 * - 遮罩:`absolute inset-0` + `background: var(--color-black-50)`,点击遮罩关闭(等价 RN `bg-black/50` 的 Pressable)。
 * - 面板:`absolute left-0 right-0 bg-card p-6`,`side==='bottom'` 取 `bottom-0 rounded-t-lg`、`side==='top'` 取 `top-0 rounded-b-lg` —— 与 RN 同组类名、同圆角档。
 * - 拖拽手柄:`h-1_5 w-10 rounded bg-border`(`_d` 形态是刻意的，见本文件末行同款说明；语义 = RN 的 1.5 高档)。
 *
 * 与 RN 的分歧(刻意、gate-clean 优先):
 * - RN 用 `Modal` + `Animated` 滑入 + `PanResponder` 下拉关闭;小程序(Taro/微信)无 Animated Modal 拖拽能力,
 *   改用 CSS `transform: translateY()` + `transition` 模拟滑入/滑出(无下拉手势关闭,保留点遮罩关闭)。等价行为、可编译、零平台私有依赖。
 * - RN 关闭走 `setTimeout(ANIM_DURATION)` 后卸载 Modal;本端同源:open=false 时先播退出动画再 `return null` 卸载。
 */
export interface SheetProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  side?: 'bottom' | 'top'
}

const ANIM_DURATION = 300
const OVERLAY_Z = 1000

export function Sheet({ open, onOpenChange, children, side = 'bottom' }: SheetProps) {
  // open=false 时先播退出动画,动画结束再卸载(对齐 RN 的 setTimeout 卸载时序)。
  const [render, setRender] = useState(open)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (open) {
      setRender(true)
      // 等首帧提交初始 off-screen 位置后切到目标位,触发 transition 滑入。
      const t = setTimeout(() => setEntered(true), 20)
      return () => clearTimeout(t)
    }
    setEntered(false)
    const t = setTimeout(() => setRender(false), ANIM_DURATION)
    return () => clearTimeout(t)
  }, [open])

  if (!render) return null

  const close = () => onOpenChange?.(false)
  const isBottom = side === 'bottom'
  const offscreen = isBottom ? '100%' : '-100%'
  const panelTransform = entered ? 'translateY(0)' : `translateY(${offscreen})`

  return (
    <View className="fixed inset-0" style={{ zIndex: OVERLAY_Z }} onClick={close}>
      {/* 遮罩:var(--color-black-50),等价 RN bg-black/50 */}
      <View className="absolute inset-0" style={{ background: 'var(--color-black-50)' }} />
      <View
        className={cn(
          'absolute left-0 right-0 bg-card p-6',
          isBottom ? 'bottom-0 rounded-t-lg' : 'top-0 rounded-b-lg',
        )}
        style={{ transform: panelTransform, transition: `transform ${ANIM_DURATION}ms ease` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖拽手柄:单层可见细线(对齐 RN 1.5 高档 = h-1_5 / w-10 rounded bg-border；`_d` 写法勿改回) */}
        <View className="mb-4 items-center">
          <View className="h-[12rpx] w-10 rounded bg-border" />
        </View>
        {children}
      </View>
    </View>
  )
}

export default Sheet
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
