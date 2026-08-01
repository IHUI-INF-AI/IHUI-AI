import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'
// 2026-08-01 错误中文化:全局 mutation onError 必须走 toastProxy(走事件总线 + Toaster 拦截器
// + toUserFriendlyMessage 中文化)。原来动态 import 'sonner' 会绕过拦截器直接显示英文。
// 不能用静态 import(会引入 query-client → components/common → Toaster 循环依赖),
// 改用懒加载 @/components/common 的 toastProxy。
async function getToast() {
  const { toast } = await import('@/components/common')
  return toast
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // P1-4 修复(2026-07-28):gcTime 从默认 5 分钟降到 2 分钟,加速未使用查询的 GC,
        // 减少长会话中缓存查询的内存占用(默认 5 分钟太长,长会话累积大量 stale 查询)
        gcTime: 2 * 60 * 1000,
        retry: 1,
      },
      mutations: {
        onError: (error) => {
          if (!isServer) {
            // 走 toastProxy → __ihui_toast__ 事件 → Toaster 拦截器 → toUserFriendlyMessage 中文化
            void getToast().then((toast) => toast.error(error.message))
          }
        },
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (isServer) return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}
