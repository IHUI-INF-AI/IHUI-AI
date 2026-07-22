'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * 监听 middleware / SSR 设置的 `login_redirect` cookie 或 `?reauth=1&next=...` 查询参数,
 * 自动打开 LoginDialog。挂在根 layout 客户端组件树中,首屏 hydration 后读取一次,
 * 触发弹窗 + 清理 cookie/参数,登录成功后由 LoginFormContent 的 onSuccess 关闭弹窗,
 * 配合 `useLoginDialogStore.redirectUrl` 回跳到原目标。
 */
export function LoginRedirectListener() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const open = useLoginDialogStore((s) => s.open)

  React.useEffect(() => {
    if (typeof document === 'undefined') return

    // 1. 优先处理 URL 查询参数 (来自 SSR 重定向,如 sso/redirect)
    const reauth = searchParams.get('reauth')
    const nextParam = searchParams.get('next')
    if (reauth === '1' && nextParam) {
      const cleaned = nextParam
      open('login', cleaned)
      // 清理 URL 上的 reauth 参数
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
    // 首页 / 等公开路径不弹窗(2026-07-23:用户要求"刷新进项目不要弹窗")
    if (target && target !== '/') {
      open('login', target)
    }
  }, [open, router, searchParams])

  return null
}
