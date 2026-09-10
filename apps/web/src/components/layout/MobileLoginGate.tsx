// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useIsMobile } from '@/hooks/use-media-query'

/**
 * MobileLoginGate — 移动 App(Capacitor 壳)全局登录墙(App 级鉴权守卫)。
 *
 * 2026-09-07 新建。解决:移动 App 未登录进入时,首屏应是独立登录页,而非直接看到
 * 对话工作区(用户 2026-09-07 反馈"一上来显示对话页而不是独立登录页")。
 *
 * 判定(三条件同时满足才启用登录墙,任一不满足则完全放行 children):
 *  - isNativeApp:window.Capacitor.isNativePlatform()===true → 仅 mobile-cap 壳注入
 *    window.Capacitor,桌面浏览器 / 手机浏览器 / 浏览器移动模拟 均无 → 严格保证
 *    「只改移动 App,桌面/Web 零影响」。
 *  - isMobile:useIsMobile()(<1024px,与 LoginDialog 全屏形态判定一致)。
 *  - 未登录:!isAuthenticated。
 *
 * 行为:未登录时 via useEffect 自动 open 全屏 LoginDialog(LoginDialog 对移动端已是
 * 独立全屏页形态),且本组件**不渲染 children**(对话/工作区/营销内容统统不挂载),
 * 因此"首屏就是登录页"、无闪烁、children 不会发起未登录 API 请求。登录成功后
 * LoginDialog 关闭、isAuthenticated→true,children 自然透出(回到工作区/对话页)。
 *
 * 登录态异步恢复(bootstrap 刷新 httpOnly cookie)的时序:已认证则关闭守卫打开的登录框,
 * 避免"已登录但登录框残留"。redirectUrl===null 近似标识«由守卫打开»,不误关用户手动开的框。
 */
export function MobileLoginGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isMobile = useIsMobile()

  // SSR 安全:仅客户端探测。纯浏览器无 window.Capacitor → false,守卫短路。
  const [isNativeApp] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return (
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })?.Capacitor
        ?.isNativePlatform?.() === true
    )
  })

  const shouldGate = isNativeApp && isMobile && !isAuthenticated

  React.useEffect(() => {
    if (shouldGate) {
      // redirectUrl 缺省:登录成功留在当前页(工作区随之透出),不强制跳转
      useLoginDialogStore.getState().open('login', undefined)
    } else if (isNativeApp && isMobile && isAuthenticated) {
      // bootstrap 异步恢复登录态时,自动关闭守卫早先打开的登录框,避免残留
      const s = useLoginDialogStore.getState()
      if (s.isOpen && s.redirectUrl === null) s.close()
    }
  }, [shouldGate, isNativeApp, isMobile, isAuthenticated])

  // 移动 App 未登录时:不渲染 children(对话/工作区/营销内容统统不挂载,避免闪烁与
  // 未登录 API 请求),只渲染一个空壳,由全屏 LoginDialog 作为实际首屏。登录成功后
  // isAuthenticated→true,shouldGate→false,children 透出。桌面/Web 恒走 children。
  if (shouldGate) {
    return (
      <>
        {/* 全屏登录框作为首屏,门禁期间不渲染 children */}
      </>
    )
  }

  return <>{children}</>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
