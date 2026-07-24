import { Suspense } from 'react'
import PageClient from './PageClient'

// A 套壳:output:'export' 要求动态路由提供 generateStaticParams(返回非空数组)
// page.tsx 是 Server Component wrapper(不能 'use client'),实际页面逻辑在 PageClient.tsx。
// PageClient 使用 useSearchParams(),必须用 <Suspense> 包裹(output:'export' 强制要求)
export function generateStaticParams() {
  return [{ id: '1' }]
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
