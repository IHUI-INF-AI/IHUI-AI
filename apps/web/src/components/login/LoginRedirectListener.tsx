'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { isPublicPath, openLoginDialogOnce } from '@/lib/login-dialog-trigger'

/**
 * 监听 middleware / SSR 设置的 `login_redirect` cookie 或 `?reauth=1&next=...` 查询参数,
 * 自动打开 LoginDialog。挂在根 layout 客户端组件树中,首屏 hydration 后读取一次,
 * 触发弹窗 + 清理 cookie/参数,登录成功后由 LoginFormContent 的 onSuccess 关闭弹窗,
 * 配合 `useLoginDialogStore.redirectUrl` 回跳到原目标。
 *
 * 懒触发策略(2026-07-24 深度根治,统一走 login-dialog-trigger 共享决策中心):
 * - 公开路径(/ /login /register 等)不弹窗,仅清理 URL/cookie
 * - 受保护路径弹窗 + 清理
 * - URL 上的 reauth/next 无论是否弹窗都必须清理,避免刷新重复触发(回归根因)
 * - openLoginDialogOnce 自带全局去重 guard,防并发弹窗/StrictMode 双调用
 */
export function LoginRedirectListener() {
  const router = useRouter()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    if (typeof document === 'undefined') return

    // 1. 优先处理 URL 查询参数 (来自 SSR 重定向,如 sso/redirect)
    const reauth = searchParams.get('reauth')
    const nextParam = searchParams.get('next')
    if (reauth === '1' && nextParam) {
      const cleaned = nextParam
      if (!isPublicPath(cleaned)) {
        openLoginDialogOnce(cleaned)
      }
      // 始终清理 URL 上的 reauth/next 参数,避免刷新重复触发弹窗
      const url = new URL(window.location.href)
      url.searchParams.delete('reauth')
      url.searchParams.delete('next')
      window.history.replaceState(
        null,
        '',
        url.pathname + (url.search ? url.search : '') + url.hash,
      )
      return
    }

    // 2. 处理 middleware 设置的 cookie
    const match = document.cookie.match(/(?:^|;\s*)login_redirect=([^;]+)/)
    if (!match) return
    const target = decodeURIComponent(match[1] ?? '')
    document.cookie = 'login_redirect=; path=/; max-age=0'
    // 仅当用户访问的是需要登录的受保护路由时才弹窗
    // 首页 / 登录 / 注册等公开路径不弹窗(2026-07-23:用户要求"刷新进项目不要弹窗")
    if (target && !isPublicPath(target)) {
      openLoginDialogOnce(target)
    }
  }, [router, searchParams])

  return null
}
