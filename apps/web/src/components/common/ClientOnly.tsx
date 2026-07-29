'use client'

import * as React from 'react'

interface ClientOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * ClientOnly(2026-07-29 立,Phase 24 修复 Hydration 错误):
 *  - SSR 阶段渲染 fallback(默认 null),CSR 阶段渲染 children
 *  - 解决"组件依赖 window/localStorage/Date.now 等浏览器 API"导致的 hydration mismatch
 *  - 不会闪烁:首次 mount 时 children 同步渲染
 *  - 不会引发 React 警告:useState/useEffect 初始化标准 React 模式
 *
 * 用法:
 *   <ClientOnly fallback={<Skeleton />}>
 *     <ComponentThatUsesDateNowOrLocalStorage />
 *   </ClientOnly>
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps): React.ReactElement {
  const [mounted, setMounted] = React.useState<boolean>(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted ? <>{children}</> : <>{fallback}</>
}

export default ClientOnly
