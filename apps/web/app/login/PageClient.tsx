'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * /login 软路由客户端(2026-07-31 立)。
 *
 * 设计:
 * - /login 不渲染独立页面(用户偏好:登录/注册应该是弹窗形式,不要独立页)
 * - 挂载时立即打开全局 LoginDialog(app/layout.tsx 已挂载),然后 router.back() 回前一页
 * - 工作展示区保留前一页内容(用户视觉上看到"弹窗 + 前一页背景",而不是 404)
 * - 无 history(用户直接输入 /login)时降级到 router.replace(redirect || '/')
 *
 * 模式参考:(auth)/forgot-password/page.tsx 的 open() + replace('/') 组合,
 * 这里改用 back() 以保留前一页工作区内容(符合用户期望)。
 *
 * 兼容场景:
 * - use-user-menu.ts 未登录菜单"登录"按钮 href='/login' → 弹窗 + 回前一页
 * - account-deletion 注销账号后 window.location.href='/login' → 弹窗 + 回前一页或首页
 *
 * redirect 参数:?redirect=/dashboard → 登录成功后由 LoginDialog.handleLoginSuccess 跳转
 * 不带 redirect 时 redirectUrl=null,登录成功后留在当前页(router.back 已回前一页)。
 */
export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  useEffect(() => {
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
  }, [router, redirect])

  return null
}
