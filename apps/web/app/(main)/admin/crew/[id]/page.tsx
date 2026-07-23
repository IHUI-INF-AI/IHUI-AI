import PageClient from './PageClient'

// A 套壳:静态导出要求动态路由提供 generateStaticParams,返回 [] 不预生成,运行时客户端渲染。
// page.tsx 是 Server Component wrapper(不能 'use client'),实际页面逻辑在 PageClient.tsx。
export function generateStaticParams() {
  return []
}

export default function Page() {
  return <PageClient />
}
