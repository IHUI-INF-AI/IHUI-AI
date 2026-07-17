'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * 监听 middleware 设置的 `login_redirect` cookie 并自动打开 LoginDialog。
 * 挂在根 layout 客户端组件树中,首屏 hydration 后读取一次 cookie,
 * 触发弹窗 + 清理 cookie,登录成功后由 LoginFormContent 的 onSuccess 关闭弹窗,
 * 配合 `useLoginDialogStore.redirectUrl` 回跳到原目标。
 */
export function LoginRedirectListener() {
  const router = useRouter()
  const open = useLoginDialogStore((s) => s.open)

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const match = document.cookie.match(/(?:^|;\s*)login_redirect=([^;]+)/)
    if (!match) return
    const target = decodeURIComponent(match[1] ?? '')
    document.cookie = 'login_redirect=; path=/; max-age=0'
    if (target && target !== '/') {
      open('login', target)
    } else {
      open('login')
      void router.replace('/')
    }
  }, [open, router])

  return null
}
