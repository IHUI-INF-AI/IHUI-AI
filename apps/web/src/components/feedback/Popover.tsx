'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Tooltip } from './Tooltip'

interface PopoverProps {
  content: React.ReactNode
  children: React.ReactElement
  position?: 'top' | 'right' | 'bottom' | 'left'
  trigger?: 'click' | 'hover'
  /** 弹出层 a11y 描述;不传时回退到 children 的 aria-label/文本 */
  'aria-label'?: string
  className?: string
  /**
   * true 时把弹层 portal 到 document.body 并用 fixed 定位,
   * 通过 trigger.getBoundingClientRect() 计算坐标。
   * 解决祖先 overflow:hidden 裁剪弹层的问题(如 MainShell h-screen overflow-hidden)。
   * 默认 false(沿用 absolute 定位,保持向后兼容)。
   */
  portal?: boolean
  /**
   * portal 模式下沿用旧 absolute 行为的对齐方向(top|bottom|left|right) + 间距(px)。
   * 默认 { side: position, gap: 8 }。可显式覆盖,例如弹层要"底部对齐 trigger"用
   * { side: 'right', align: 'bottom', gap: 8 }。
   */
  align?: 'start' | 'center' | 'end'
  /**
   * 可选:hover 时显示的轻量文字提示(用 Radix Tooltip 实现,需外层 TooltipProvider)。
   * 与 click 弹出的 content 弹层并存:hover → tooltip,click → popover。
   * 适合侧边栏图标按钮:鼠标悬停显示按钮名称,点击展开功能菜单。
   */
  tooltip?: React.ReactNode
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  /**
   * 受控模式(2026-07-25 新增):外部控制 open 状态。
   * 用于"下拉菜单项触发内部状态切换"场景(如菜单项切换显示 SkillLibrary),
   * 需要从 content 内部反向通知关闭。
   * 不传则走内部 useState 非受控模式(保持原有行为)。
   */
  open?: boolean
  /** 受控模式:open 状态变化回调 */
  onOpenChange?: (open: boolean) => void
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// useLayoutEffect 在 'use client' 模块下同步算坐标,避免弹层首次渲染闪烁;
// SSR 时退化为 useEffect 避免警告
const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect

export function Popover({
  content,
  children,
  position = 'bottom',
  trigger = 'click',
  'aria-label': ariaLabel,
  className,
  portal = false,
  align = 'center',
  tooltip,
  tooltipSide = 'top',
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  // 受控 / 非受控双模式(2026-07-25 立):外部传 open 即受控,否则用内部 useState。
  // setOpen 走统一包装函数,click-outside / ESC / trigger 切换都通过它,
  // 避免受控/非受控逻辑分散。
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) {
        onOpenChange?.(next)
      } else {
        setInternalOpen(next)
      }
    },
    [isControlled, onOpenChange],
  )
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const triggerElRef = React.useRef<HTMLElement | null>(null)
  // 包装 div 引用,click-outside 用
  const ref = React.useRef<HTMLDivElement>(null)

  // click-outside:同时检查 trigger 容器(ref)和弹层(contentRef)。
  // 2026-07-27 修复:portal 模式下弹层 portal 到 document.body,不在 ref 内,
  // 原 useClickOutside 只检查 ref → 点击弹层内 button 被误判为"外部"→ mousedown 关闭弹层
  // → button 卸载 → click 事件无法触发 → 语言切换等菜单项点击失效。
  // 现在同时检查 contentRef,点击弹层内部不关闭,让 button 的 onClick 正常触发。
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: MouseEvent | TouchEvent) => {
      const triggerEl = ref.current
      const contentEl = contentRef.current
      const target = event.target as Node
      if (triggerEl && triggerEl.contains(target)) return
      if (contentEl && contentEl.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [setOpen])

  // portal 模式:动态计算 fixed 坐标(随 trigger 滚动/resize 同步)
  // 直接计算最终 left/top(已含 align 平移)+ 视口边界 clamp,避免弹层超出视口
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const updateCoords = React.useCallback(() => {
    if (!portal || !triggerElRef.current) return
    const r = triggerElRef.current.getBoundingClientRect()
    const gap = 8
    const pad = 8 // 视口安全 padding
    const VW = window.innerWidth
    const VH = window.innerHeight

    // 读已渲染弹层尺寸(首次渲染时 contentRef 可能尚未赋值 → popW/H=0,跳过 clamp)
    const popRect = contentRef.current?.getBoundingClientRect()
    const popW = popRect?.width ?? 0
    const popH = popRect?.height ?? 0

    // 计算 anchor 坐标(已包含 align 平移;主方向决定外缘,align 决定正交方向)
    let top = 0
    let left = 0
    if (position === 'right') {
      left = r.right + gap
      if (align === 'start') top = r.top
      else if (align === 'end') top = r.bottom - popH
      else top = r.top + r.height / 2 - popH / 2
    } else if (position === 'left') {
      left = r.left - gap - popW
      if (align === 'start') top = r.top
      else if (align === 'end') top = r.bottom - popH
      else top = r.top + r.height / 2 - popH / 2
    } else if (position === 'top') {
      top = r.top - gap - popH
      if (align === 'start') left = r.left
      else if (align === 'end') left = r.right - popW
      else left = r.left + r.width / 2 - popW / 2
    } else {
      // bottom
      top = r.bottom + gap
      if (align === 'start') left = r.left
      else if (align === 'end') left = r.right - popW
      else left = r.left + r.width / 2 - popW / 2
    }

    // 视口 clamp(仅在已读到 popRect 时)
    let finalTop = top
    let finalLeft = left
    if (popW > 0 && popH > 0) {
      finalLeft = Math.max(pad, Math.min(finalLeft, VW - popW - pad))
      finalTop = Math.max(pad, Math.min(finalTop, VH - popH - pad))
    }

    setCoords({ top: finalTop, left: finalLeft })
  }, [portal, position, align])

  // P2 修复:scroll/resize 监听改 passive:true 减少浏览器开销;updateCoords 加 rAF 节流,
  // 避免一次 scroll 事件多次触发 updateCoords(含 getBoundingClientRect 强制 layout)
  const rafRef = React.useRef<number | null>(null)
  const updateCoordsThrottled = React.useCallback(() => {
    if (rafRef.current !== null) return // 已有 pending rAF,跳过
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      updateCoords()
    })
  }, [updateCoords])

  // useLayoutEffect 同步算坐标,避免首次渲染时弹层在 (0,0) 闪烁
  useIsoLayoutEffect(() => {
    if (!open || !portal) return
    updateCoords()
    // 同步 trigger 位置变化(滚动/resize);passive:true 减少浏览器开销
    window.addEventListener('scroll', updateCoordsThrottled, { capture: true, passive: true })
    window.addEventListener('resize', updateCoordsThrottled, { passive: true })
    // 监听 trigger 自身尺寸变化(Sidebar 折叠/展开)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (ro && triggerElRef.current) ro.observe(triggerElRef.current)
    // 监听弹层尺寸变化(通知中心图片懒加载后高度变化触发重算)
    const roContent =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateCoords) : null
    if (roContent && contentRef.current) roContent.observe(contentRef.current)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('scroll', updateCoordsThrottled, true)
      window.removeEventListener('resize', updateCoordsThrottled)
      ro?.disconnect()
      roContent?.disconnect()
    }
  }, [open, portal, updateCoords, updateCoordsThrottled])

  const posClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-0 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-0 mr-2',
  }

  // ESC 关闭 + Tab 焦点陷阱 + 关闭后焦点回归 trigger
  React.useEffect(() => {
    if (!open) return
    // 记录触发元素,关闭后焦点回归
    if (typeof document !== 'undefined') {
      triggerElRef.current = (document.activeElement as HTMLElement) ?? null
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab' || !contentRef.current) return
      // 焦点陷阱:循环在 content 内可聚焦元素
      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || !contentRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    // 打开时把焦点送入 content(让屏幕阅读器宣告),首个可聚焦元素
    const firstFocusable = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    firstFocusable?.focus()
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // 关闭时焦点回归 trigger
      triggerElRef.current?.focus?.()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- setOpen 的 useCallback 依赖 isControlled/onOpenChange,部分调用方(onOpenChange 内联箭头)会让 setOpen 每 render 变化;若加入依赖,弹层打开期间父组件重渲染会使本 effect 反复清理+重跑(firstFocusable.focus()),打断用户键盘操作。ESC 关闭场景 setOpen 无需最新引用。

  const triggerProps =
    trigger === 'hover'
      ? { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }
      : {
          onClick: (e: React.MouseEvent) => {
            // 2026-07-29 修复:弹层内部点击不切换 trigger 状态。
            // 原因:trigger 的外层 div 包含弹层(overlay),点击弹层内 button(如命令项)时
            // 事件冒泡到外层 div → setOpen(!open) → 弹窗被误关。
            // 与 click-outside handler(line 100-101)的 contentRef 检查逻辑保持一致:
            // 弹层内部点击由 button 自己的 onClick 决定是否 onOpenChange(false),不靠 trigger 切换。
            if (contentRef.current && contentRef.current.contains(e.target as Node)) return
            setOpen(!open)
          },
        }

  // 抓 trigger DOM 节点(用 callback ref 赋值给 triggerElRef)
  // 2026-07-31 React 19 兼容:原 `children.ref` 在 React 19 标记 deprecated(console.error
  // "Accessing element.ref was removed in React 19"),改为 `children.props.ref` 兼容两版。
  // React 16.3+ forwardRef 起所有 React 元素都能从 props 访问 ref,所以两版等价。
  const childWithRef = React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      triggerElRef.current = node
      // 保留 children 自带的 ref 行为(React 18/19 兼容写法)
      const childProps = (children as React.ReactElement<{ ref?: React.Ref<HTMLElement> }>).props
      const childRef = childProps?.ref
      if (typeof childRef === 'function') childRef(node)
      else if (childRef && typeof childRef === 'object') {
        ;(childRef as React.MutableRefObject<HTMLElement | null>).current = node
      }
    },
  })

  // 可选:用 Radix Tooltip 包裹 trigger,实现 hover 提示(与 click Popover 共存)
  // Radix Slot 会合并 ref + onClick,与上方 cloneElement 注入的 ref/onClick 链式透传不冲突
  const finalChild = tooltip ? (
    <Tooltip content={tooltip} side={tooltipSide}>
      {childWithRef}
    </Tooltip>
  ) : (
    childWithRef
  )

  // 弹层节点(非 portal: 走原 absolute; portal: 走 fixed + 坐标)
  const overlay = open ? (
    <div
      ref={contentRef}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={cn(
        'rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring',
        // z-popover 来自设计 tokens,与 Dropdown/Tooltip 同级
        portal ? 'fixed z-popover' : 'absolute z-popover',
        // 非 portal:用预设定位类;portal:由内联 style 定位(left/top 已含 align 平移 + 视口 clamp)
        !portal && posClass[position],
        className,
      )}
      style={
        portal
          ? {
              // coords=null 时藏到屏幕外,useLayoutEffect 会同步算出真正坐标避免 (0,0) 闪烁
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
            }
          : undefined
      }
    >
      {content}
    </div>
  ) : null

  if (portal) {
    return (
      <div ref={ref} className="relative inline-block" {...triggerProps}>
        {finalChild}
        {typeof document !== 'undefined' && createPortal(overlay, document.body)}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-block" {...triggerProps}>
      {finalChild}
      {overlay}
    </div>
  )
}
