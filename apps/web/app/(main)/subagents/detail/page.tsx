import { Suspense } from 'react'
import SubagentDetailClient from './SubagentDetailClient'

/**
 * Subagent 派单详情页(静态路由,兼容 next.config.ts output: 'export')。
 *
 * 原 /subagents/[id] 动态路由在 output: 'export' 下与 dynamicParams: true 冲突(500),
 * 改用 /subagents/detail?id=xxx query 参数路由,客户端 useSearchParams 读取 id。
 *
 * useSearchParams 要求 Suspense boundary(Next.js 15 强制),否则 build 退化为 client-rendered。
 */

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          加载中...
        </div>
      }
    >
      <SubagentDetailClient />
    </Suspense>
  )
}
