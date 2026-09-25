// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import * as React from 'react'

import { isTopOverlay, popOverlay, pushOverlay } from './overlay-stack'

/**
 * Radix Content 家族(Dialog/Sheet/Drawer/Select)统一的 Esc 层栈接入。
 *
 * 注册必须走 **ref callback**(mergeEscStackRef)而不是 Portal 内组件的
 * useEffect:Radix Portal 子树的 passive effects flush 跨渲染批,fireEvent /
 * 受控更新后栈序会乱(实测 Dialog 的 push 晚于其后打开的自绘层,互斥反转)。
 * ref callback 同步于 commit 阶段 —— DOM 挂载即 push、卸载即 pop,时序确定;
 * 关闭动画期间(Presence 仍挂)id 尚在栈顶,不影响逐层退出语义。
 */

/** 每实例唯一的浮层栈 id(在 Content 包装组件里取)。 */
export function useEscStackId(): string {
  return React.useId()
}

/**
 * 合并外部转发 ref 与层栈注册:node 挂载即 push、卸载即 pop。
 * 返回的 callback 经调用方 useCallback 钉住,避免每次渲染 pop+push 把该层
 * 顶回栈顶、压过之后打开的自绘层。
 */
export function mergeEscStackRef<T extends HTMLElement>(
  id: string,
  forwarded: React.ForwardedRef<T> | undefined,
): (node: T | null) => void {
  return (node) => {
    if (node) pushOverlay(id)
    else popOverlay(id)
    if (typeof forwarded === 'function') forwarded(node)
    else if (forwarded) (forwarded as React.MutableRefObject<T | null>).current = node
  }
}

/**
 * 合成 Radix Content 的 onEscapeKeyDown:非栈顶时 preventDefault 拦下 Radix
 * 内建的 dismiss(此后自绘层的 isTopOverlay 守卫才有互斥意义),再透传调用方
 * 自己的 onEscapeKeyDown,行为零破坏。
 */
export function guardEscKeyDown(
  id: string,
  caller?: (event: KeyboardEvent) => void,
): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isTopOverlay(id)) event.preventDefault()
    caller?.(event)
  }
}
