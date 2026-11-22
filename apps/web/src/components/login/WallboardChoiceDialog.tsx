// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

/**
 * 管理员登录成功后的「要不要看数据大屏」二选一弹窗(2026-10-18 立,用户要求
 * "登录 admin 账号时弹一个窗口问我要不要看数据大屏,让我自己选择")。
 *
 * 取代 2026-10-17 的"管理员登录默认直接跳大屏":resolvePostLoginLanding 算出大屏落点后
 * 不再自动 router.push,而是经 requestWallboardChoice 交给本弹窗,由用户点「看大屏」或
 * 「先不用」。表单登录(LoginDialog)与 App 扫码登录(AppQrPanel)两条链路共用。
 *
 * 为什么用模块级订阅而不是 props/全局 store:登录确认后登录弹窗会 close(),AppQrPanel
 * 随之卸载、面板内部状态存不住选择;LoginDialog 组件本身常驻根布局(root layout)不卸载,
 * 把 <WallboardChoiceDialog /> 挂在那里,选择窗在整个登录流程中稳定存活。
 */

type WallboardChoiceListener = (landing: string | null) => void

const listeners = new Set<WallboardChoiceListener>()

/**
 * 「先不用」的回落落点(模块级,随每次请求刷新):
 * - LoginDialog 主站场景不传 —— 用户点了「先不用」就留在当前页;
 * - OAuth 回调页等**无法停留的中间页**场景传 '/' —— 停在回调页没有意义,选完直接去首页。
 */
let stayFallback: string | undefined

/**
 * 登录链路调用:请求弹出「要不要看数据大屏」选择窗。
 * @param landing 建议落点(生产监控大屏路径);传 null 仅收起已打开的选择窗。
 * @param opts.stayFallback 选「先不用」后跳往的回落路径(中间页场景传 '/',见上)。
 */
export function requestWallboardChoice(
  landing: string | null,
  opts?: { stayFallback?: string },
): void {
  stayFallback = opts?.stayFallback
  for (const notify of listeners) notify(landing)
}

export function WallboardChoiceDialog() {
  const router = useRouter()
  const [landing, setLanding] = React.useState<string | null>(null)

  React.useEffect(() => {
    const notify: WallboardChoiceListener = (value) => setLanding(value)
    listeners.add(notify)
    return () => {
      listeners.delete(notify)
    }
  }, [])

  const handleGo = React.useCallback(() => {
    const target = landing
    setLanding(null)
    if (!target) return
    // 跳转沿用登录链路的 250ms 余量:等弹窗遮罩淡出后再切路由,
    // 避免 RSC 拉取 + 新页面树渲染与遮罩淡出同帧竞争(与 handleLoginSuccess 同口径)。
    setTimeout(() => {
      router.push(target)
    }, 250)
  }, [landing, router])

  const handleStay = React.useCallback(() => {
    setLanding(null)
    // OAuth 回调页等中间页:停留无意义,按调用方声明的回落路径离开(通常是 '/')。
    const fallback = stayFallback
    stayFallback = undefined
    if (fallback) router.push(fallback)
  }, [router])

  return (
    <ConfirmDialog
      open={!!landing}
      title="要看数据大屏吗？"
      description="大屏实时展示生产运行状态;之后可随时从左侧「数据看板 → 监控大屏」进入。"
      confirmText="看大屏"
      cancelText="先不用"
      onConfirm={handleGo}
      onCancel={handleStay}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
