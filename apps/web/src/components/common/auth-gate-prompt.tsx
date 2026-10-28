// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { LogIn } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'

/**
 * 登录引导占位(与 use-auth-gate.ts 配对,2026-09-30 整类修复的复用出口)。
 * 未登录/会话过期时替代页面数据区渲染:图标 + 文案 + 登录按钮(登录后回跳当前页)。
 * 替代的旧行为:发注定 401 的请求 → 「加载中」空转 → 「操作失败,请稍后重试」。
 */
export function AuthGatePrompt({
  message,
  returnTo,
  className,
}: {
  /** 提示文案(各页面按自己的 i18n/文案风格传入,如「请先登录后查看收藏」) */
  message: string
  /** 登录成功后的回跳目标;缺省取当前路径+查询串 */
  returnTo?: string
  className?: string
}) {
  const handleClick = React.useCallback(() => {
    const target =
      returnTo ??
      (typeof window === 'undefined'
        ? '/'
        : window.location.pathname + window.location.search)
    openLoginDialogOnce(target)
  }, [returnTo])
  return (
    <div
      className={
        'flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground' +
        (className ? ` ${className}` : '')
      }
    >
      <LogIn className="h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
      <Button size="sm" onClick={handleClick}>
        {message}
      </Button>
    </div>
  )
}
