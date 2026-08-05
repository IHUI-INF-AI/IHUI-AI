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
        // 2026-08-05 修复导航切换慢:从 60s 提升到 5 分钟,确保导航回已访问页面时,
        // 数据仍 fresh,React Query 不触发 refetch,页面立即渲染缓存内容。
        // 根因:用户的 80+ 导航项在 (main) 路由组内切换,每个页面都是 Client Component
        // + useQuery 拉数据。旧 staleTime=60s 导致离开 1 分钟再回来就 refetch,
        // 页面先显示 loading 态再渲染数据,用户感知"切换慢"。
        // gcTime 同步提升到 10 分钟,防止缓存过早 GC 导致导航回旧页面时白屏加载。
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        // 页面切换场景:切换 tab 回来不要触发 refetch(旧默认 true),避免不必要网络请求
        refetchOnWindowFocus: false,
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
