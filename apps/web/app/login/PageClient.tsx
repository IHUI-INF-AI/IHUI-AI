'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { QrTab } from '@ihui/ui-react'
import type { ThirdPartyPlatform } from '@ihui/types'
import { QrCodeLogin } from '@/components/login/QrCodeLogin'
import { QR_PLATFORMS } from '@/components/login/LoginFormContent'

/**
 * /login 软路由客户端(2026-07-31 立,2026-08-04 加嵌入式二维码模式)。
 *
 * 三种模式:
 *
 * 1. 正常模式(无 method 参数):
 *    - 不渲染独立页面(用户偏好:登录/注册应该是弹窗形式,不要独立页)
 *    - 挂载时立即打开全局 LoginDialog,然后 router.back() 回前一页
 *    - 无 history 时降级到 router.replace(redirect || '/')
 *
 * 2. 嵌入式二维码面板模式(?method=qr&platform=wechat):
 *    - 渲染带平台切换 tab 的完整二维码面板(QrTab + QrCodeLogin)
 *    - 供用户直接访问 /login?method=qr 完成扫码登录
 *    - platform 参数自动选中对应平台
 *
 * 3. 纯二维码嵌入模式(?method=qr&platform=wechat&embed=true):
 *    - 只渲染 QrCodeLogin 组件(280x280),无外层容器、无平台切换 tab
 *    - 供 mobile-rn WebView / iframe 嵌入显示真实二维码
 *    - mobile-rn 端已有自己的平台切换 tab,iframe 内不需要重复
 *
 * 兼容场景:
 * - use-user-menu.ts 未登录菜单"登录"按钮 href='/login' → 弹窗 + 回前一页
 * - account-deletion 注销账号后 window.location.href='/login' → 弹窗 + 回前一页或首页
 * - mobile-rn WebView 加载 /login?method=qr&platform=wechat&embed=true → 纯二维码面板
 */
export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const method = searchParams.get('method')
  const isQrMode = method === 'qr'
  const embed = searchParams.get('embed') === 'true'
  const refreshKeyParam = searchParams.get('refreshKey')
  const refreshKey = refreshKeyParam ? Number(refreshKeyParam) || 0 : 0
  const t = useTranslations()

  // QR 模式:从 URL 参数读取初始平台
  const platformParam = searchParams.get('platform') as ThirdPartyPlatform | null
  const defaultPlatform =
    platformParam && QR_PLATFORMS.some((p) => p.key === platformParam)
      ? platformParam
      : 'wechat'

  useEffect(() => {
    // QR 嵌入模式:不打开弹窗,直接渲染页面内容
    // 双重检查:isQrMode(来自 useSearchParams) + window.location.search(直接读取)
    // 避免 useSearchParams() 在客户端首次渲染时返回空对象导致 isQrMode 为 false,
    // 误触发 router.back()/replace() 把 /login?method=qr&embed=true 页面重定向到首页
    if (isQrMode) return
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('method') === 'qr') return
    }

    // 1. 打开全局登录弹窗
    //    redirectUrl=null:登录成功后留在当前页(router.back 已回前一页),不强制跳转
    //    带 ?redirect=xxx(外部指定):登录成功后跳到该地址
    useLoginDialogStore.getState().open('login', redirect ?? undefined)

    // 2. 回到前一页(保留工作展示区前一页内容)
    //    无 history(直接输入 /login / 新标签页打开)时降级到首页或 redirect
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.replace(redirect || '/')
    }
  }, [router, redirect, isQrMode])

  // 纯二维码嵌入模式:只渲染 QrCodeLogin(280x280),无外层容器、无平台切换 tab
  // 供 mobile-rn WebView / iframe 嵌入,mobile-rn 端已有自己的平台切换 tab
  if (isQrMode && embed) {
    return (
      <div
        style={{
          margin: 0,
          padding: 0,
          width: 280,
          height: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <QrCodeLogin platform={defaultPlatform} refreshKey={refreshKey} />
      </div>
    )
  }

  // QR 完整模式:渲染带平台切换 tab 的二维码面板
  if (isQrMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <QrTab
            t={t}
            platforms={QR_PLATFORMS}
            defaultPlatform={defaultPlatform}
            QrComponent={({ platform, refreshKey }) => (
              <QrCodeLogin platform={platform} refreshKey={refreshKey} />
            )}
          />
        </div>
      </div>
    )
  }

  return null
}
