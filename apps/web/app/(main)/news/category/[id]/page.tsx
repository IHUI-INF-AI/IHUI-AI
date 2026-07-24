import { Suspense } from 'react'
import PageClient from './PageClient'

// A 套壳:静态导出要求动态路由提供 generateStaticParams,返回 [] 不预生成,运行时客户端渲染。
// page.tsx 是 Server Component wrapper(不能 'use client'),实际页面逻辑在 PageClient.tsx。
// PageClient 用了 useSearchParams(),需要 Suspense 边界(静态导出要求)。
export function generateStaticParams() {
  return [{ id: '1' }]
}

export default function Page() {
  return (
    <Suspense>
      <PageClient />
    </Suspense>
  )
}
