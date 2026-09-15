// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { PORTAL_PANEL_POSITION_STYLE, type PortalPanelAnchor } from '@/lib/portal-panel-position'
import { usePortalPanelPosition } from '@/hooks/use-portal-panel-position'
import { cn } from '@/lib/utils'

/**
 * 全项目浮层统一组件(2026-09-15 立)。
 *
 * 新建浮层一律用它,不要再手写 createPortal + 坐标计算(病根历史见
 * lib/portal-panel-position.ts 文件头:各组件手写 fixed 坐标曾导致
 * position 失效 → 面板追加到 body 末尾撑高布局、被 overflow-hidden
 * 祖先裁剪、z-index 各写各的等问题)。
 *
 * 提供(统一逻辑,一处修改全项目生效):
 * - createPortal 到 document.body,彻底脱离 overflow-hidden 祖先;
 * - position: fixed + 视口 clamp + 上下翻转 + maxHeight 收敛
 *   (由 usePortalPanelPosition → computePortalPanelCoords 提供);
 * - 统一 z-popover 层级 token(可用 zIndexClassName 覆盖);
 * - 传 onClose 时统一 Escape + 外点(mousedown/touchstart)关闭。
 *
 * 用法:
 *   <PortalPanel open={open} anchorRef={triggerRef} side="bottom" align="start"
 *     onClose={() => setOpen(false)} className="w-60 rounded-md border bg-popover shadow-md">
 *     ...内容...
 *   </PortalPanel>
 *
 * 面板默认没有任何外观样式,className 按需给(与旧手写浮层一致的
 * rounded/border/bg-popover/shadow 组合)。
 */
export interface PortalPanelProps extends PortalPanelAnchor {
  /** 浮层打开状态 */
  open: boolean
  /**
   * 锚点(触发器)元素 ref:定位基准 + 外点关闭时排除点击。
   * 类型放宽到 Element:同时容纳 HTML 与 SVG 锚点(如图拓扑节点的 <g>)。
   */
  anchorRef: React.RefObject<Element | null>
  /** 提供 → 统一 Escape + 外点关闭;不传则关闭逻辑由调用方自理 */
  onClose?: () => void
  /** 面板外观(z-popover 已内置,无需重复) */
  className?: string
  /** 追加内联样式(坐标由组件写入,同名键以这里的为准) */
  style?: React.CSSProperties
  /** 无障碍角色(menu / dialog / tooltip 等) */
  role?: string
  /** 测试锚点 → data-testid */
  testId?: string
  /** 覆盖默认 z-popover(极少用;如 GlobalTopBar 需要压 header 层) */
  zIndexClassName?: string
  /** 需要在面板元素上做焦点管理/contains 判断时,透传面板 ref */
  panelRef?: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}

export function PortalPanel({
  open,
  anchorRef,
  onClose,
  className,
  style,
  role,
  testId,
  zIndexClassName = 'z-popover',
  panelRef: externalPanelRef,
  side,
  align,
  gap,
  children,
}: PortalPanelProps) {
  const innerPanelRef = React.useRef<HTMLDivElement>(null)
  const panelRef = externalPanelRef ?? innerPanelRef
  const coords = usePortalPanelPosition({
    anchorRef,
    panelRef,
    open,
    anchor: { side, align, gap },
  })

  // 统一关闭逻辑:Escape + 外点(mousedown/touchstart,排除面板与锚点内部)
  React.useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [open, onClose, anchorRef])

  if (!open || typeof document === 'undefined') return null

  // 首帧坐标未测得 → 藏屏外渲染一次供测量(与旧手写浮层行为一致)
  const panelStyle: React.CSSProperties = coords
    ? {
        ...PORTAL_PANEL_POSITION_STYLE,
        top: coords.top,
        left: coords.left,
        maxHeight: coords.maxHeight,
      }
    : { ...PORTAL_PANEL_POSITION_STYLE, top: -9999, left: -9999 }

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      data-testid={testId}
      className={cn(zIndexClassName, className)}
      style={{ ...panelStyle, ...style }}
    >
      {children}
    </div>,
    document.body,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
