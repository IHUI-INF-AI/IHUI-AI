'use client'

/**
 * useContextMenu — 右键菜单状态管理 hook(2026-07-28 立)
 *
 * 通用右键菜单(消息气泡 / 列表项 / 富文本块)状态管理:
 * - 监听 onContextMenu:preventDefault + 记录位置 + 打开菜单
 * - 键盘 Shift+F10 触发(无障碍)
 * - 点击外部 / Esc 关闭
 * - 屏幕边界检测,避免菜单超出视口
 * - 配套容器组件: <MessageContextMenu />
 *
 * 典型用法:
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null)
 * const { visible, position, items, contextMenuHandlers, close, currentData } =
 *   useContextMenu<Message>({
 *     buildItems: (msg) => defaultMessageMenuItems(msg),
 *     onItemClick: (item, msg) => handleClick(item, msg),
 *   })
 * return (
 *   <>
 *     <div ref={ref} {...contextMenuHandlers}>{message.content}</div>
 *     <MessageContextMenu
 *       visible={visible}
 *       position={position}
 *       items={items}
 *       onItemClick={close}
 *       onClose={close}
 *     />
 *   </>
 * )
 * ```
 */

import * as React from 'react'

import type { ContextMenuItem } from '@/components/ai/message-context-menu'

/** 屏幕坐标 */
interface Position {
  x: number
  y: number
}

export interface UseContextMenuOptions<T> {
  /** 菜单项构造函数(根据数据动态生成) */
  buildItems: (data: T) => ContextMenuItem[]
  /** 选中回调(可选,优先级高于 item.onItemClick) */
  onItemClick?: (item: ContextMenuItem, data: T) => void
  /** 菜单关闭回调 */
  onClose?: () => void
  /** 菜单默认尺寸宽(用于边界检测),默认 220 */
  menuWidth?: number
  /** 菜单默认尺寸高(用于边界检测),默认 280 */
  menuHeight?: number
  /** 距视口边缘的安全边距 px,默认 8 */
  viewportPadding?: number
}

export interface UseContextMenuReturn<T> {
  /** 是否可见 */
  visible: boolean
  /** 屏幕坐标位置 */
  position: Position
  /** 当前菜单项(根据 data 构建) */
  items: ContextMenuItem[]
  /** 当前绑定的数据 */
  data: T | null
  /** 右键事件 handler(挂在触发元素上) */
  contextMenuHandlers: {
    onContextMenu: (e: React.MouseEvent) => void
    onKeyDown: (e: React.KeyboardEvent) => void
  }
  /** 手动关闭 */
  close: () => void
  /** 当前数据(只读) */
  currentData: T | null
  /** 设置数据(用于键盘触发) */
  setData: (data: T | null) => void
}

/**
 * 把期望位置 clamp 到视口内,避免菜单超出右/下边界。
 * 如果传 `actualWidth`/`actualHeight` 则按实际尺寸 clamp,否则使用默认估算。
 */
function clampToViewport(
  desired: Position,
  vw: number,
  vh: number,
  actualWidth: number,
  actualHeight: number,
  padding: number,
): Position {
  let { x, y } = desired
  if (x + actualWidth > vw) {
    x = Math.max(padding, vw - actualWidth - padding)
  }
  if (y + actualHeight > vh) {
    y = Math.max(padding, vh - actualHeight - padding)
  }
  if (x < padding) x = padding
  if (y < padding) y = padding
  return { x, y }
}

export function useContextMenu<T>({
  buildItems,
  onItemClick,
  onClose,
  menuWidth = 220,
  menuHeight = 280,
  viewportPadding = 8,
}: UseContextMenuOptions<T>): UseContextMenuReturn<T> {
  const [visible, setVisible] = React.useState(false)
  const [position, setPosition] = React.useState<Position>({ x: 0, y: 0 })
  const [data, setDataState] = React.useState<T | null>(null)

  const dataRef = React.useRef<T | null>(null)
  dataRef.current = data

  /** 关闭(同时清掉 data,避免数据残留) */
  const close = React.useCallback(() => {
    setVisible(false)
    setDataState(null)
    onClose?.()
  }, [onClose])

  /** 设置 data(键盘触发时使用) */
  const setData = React.useCallback((next: T | null) => {
    setDataState(next)
  }, [])

  /** 计算最终位置:clamp 到视口内 */
  const computePosition = React.useCallback(
    (clientX: number, clientY: number): Position => {
      if (typeof window === 'undefined') return { x: clientX, y: clientY }
      const vw = window.innerWidth
      const vh = window.innerHeight
      return clampToViewport(
        { x: clientX, y: clientY },
        vw,
        vh,
        menuWidth,
        menuHeight,
        viewportPadding,
      )
    },
    [menuWidth, menuHeight, viewportPadding],
  )

  const onContextMenu = React.useCallback(
    (e: React.MouseEvent) => {
      // 必须 preventDefault,否则浏览器原生菜单会冒出来
      e.preventDefault()
      e.stopPropagation()
      const next = dataRef.current
      if (next === null) return
      setPosition(computePosition(e.clientX, e.clientY))
      setVisible(true)
    },
    [computePosition],
  )

  /**
   * 键盘支持:Shift+F10 触发当前焦点元素的菜单。
   * 需配合在 trigger 元素上挂 onKeyDown(默认 react 不区分 onContextMenu 是否需要键盘触发)。
   */
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.shiftKey && e.key === 'F10') {
        e.preventDefault()
        const next = dataRef.current
        if (next === null) return
        // 没有 clientX/Y,放在元素中心
        const target = e.currentTarget
        let cx = 0
        let cy = 0
        if (target instanceof HTMLElement) {
          const rect = target.getBoundingClientRect()
          cx = rect.left + rect.width / 2
          cy = rect.top + rect.height / 2
        }
        setPosition(computePosition(cx, cy))
        setVisible(true)
      }
    },
    [computePosition],
  )

  // 全局点击 + Escape 关闭
  React.useEffect(() => {
    if (!visible) return
    const onPointerDown = (ev: MouseEvent | TouchEvent) => {
      const target = ev.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-context-menu-root="true"]')) return
      close()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [visible, close])

  // 卸载时关闭
  React.useEffect(() => {
    return () => {
      setVisible(false)
      setDataState(null)
    }
  }, [])

  // 暴露给 onItemClick 的内部回调(为 hook 自身封装使用,这里不直接调用)
  void onItemClick

  // 构建当前 items(data 为 null 时返回空数组)
  const items = React.useMemo<ContextMenuItem[]>(() => {
    if (data === null) return []
    return buildItems(data)
  }, [buildItems, data])

  return {
    visible,
    position,
    items,
    data,
    contextMenuHandlers: { onContextMenu, onKeyDown },
    close,
    currentData: data,
    setData,
  }
}

export default useContextMenu
