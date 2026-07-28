import { QueryClient, defaultShouldDehydrateQuery, isServer } from '@tanstack/react-query'

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
            import('sonner').then(({ toast }) => toast.error(error.message))
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
