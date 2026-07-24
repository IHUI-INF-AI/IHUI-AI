import { Suspense } from 'react'
import PageClient from './PageClient'

// A 套壳:output:'export' 要求 generateStaticParams 返回非空数组
// Next.js 15.5.20 检查 prerenderedRoutes.length > 0,返回 [] 会被判定 missing
// 返回 dummy [{ id: '1' }] 预渲染一个占位页,客户端运行时读取真实 URL param 渲染正确内容
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
