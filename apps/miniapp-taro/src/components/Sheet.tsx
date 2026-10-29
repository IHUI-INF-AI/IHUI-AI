// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { View } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import {
  SHEET_ANIM_DURATION_MS,
  SHEET_CONTENT_GAP_PX,
  SHEET_PADDING_PX,
  SHEET_RADIUS_TIER,
} from '@ihui/shared/ui/sheet-spec'

/**
 * 底部/顶部抽屉(Sheet)—— 与 `packages/ui-native/src/sheet.tsx` 逐契约对齐(「一模一样」契约)。
 *
 * **取值档一律取自 `@ihui/shared/ui/sheet-spec`**(与 web 壳、RN 壳同源);映射表由
 * `scripts/gen-ui-mirror.mjs` 与 RN 壳逐条对账。RN 原 `p-6`(24)按 spec 规则2 收敛到 12,
 * 本端此前手写的 `p-6` 同批归位 —— 两端抽屉内边距自此同一个档。
 *
 * 平台承载差异(规则6,逐条登记):
 * - RN 用 `Modal` + `Animated` 滑入 + `PanResponder` 下拉关闭;小程序(Taro/微信)无该通道,
 *   改用 CSS `transform: translateY()` + `transition` 模拟滑入/滑出(无下拉手势关闭,保留点遮罩关闭);
 * - 关闭时序同源:open=false 先播退出动画,动画结束再 `return null` 卸载(等价 RN setTimeout 卸载);
 * - 拖拽手柄命中区:RN 用 hitSlop,本端不设(无手势通道)。
 */
const RADIUS_CLASS: Record<typeof SHEET_RADIUS_TIER, { top: string; bottom: string }> = {
  xl: { top: 'rounded-t-xl', bottom: 'rounded-b-xl' },
}
const PADDING_CLASS: Record<number, string> = { 12: 'p-3' }
const CONTENT_GAP_CLASS: Record<number, string> = { 12: 'gap-3' }

export interface SheetProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
  side?: 'bottom' | 'top'
}

const ANIM_DURATION = SHEET_ANIM_DURATION_MS
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
          'absolute left-0 right-0 bg-card flex-col',
          CONTENT_GAP_CLASS[SHEET_CONTENT_GAP_PX],
          PADDING_CLASS[SHEET_PADDING_PX],
          'shadow-lg',
          isBottom
            ? `bottom-0 ${RADIUS_CLASS[SHEET_RADIUS_TIER].top}`
            : `top-0 ${RADIUS_CLASS[SHEET_RADIUS_TIER].bottom}`,
        )}
        style={{ transform: panelTransform, transition: `transform ${ANIM_DURATION}ms ease` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 拖拽手柄:12rpx = RN h-1.5(6pt);`[12rpx]` 写法勿改回 rpx 裸值 */}
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
