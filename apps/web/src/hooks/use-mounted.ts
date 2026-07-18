'use client'

import * as React from 'react'

/**
 * 客户端挂载标志
 *
 * 用于消除 SSR/CSR 之间因 zustand persist / localStorage / cookie 读取
 * 导致的 hydration mismatch。SSR 和首次客户端 render 都返回 false,
 * 仅在 effect 执行后(挂载完成)返回 true,使依赖客户端状态的条件渲染
 * 在 hydration 完成后再切换,保证首屏 HTML 一致。
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted
}
