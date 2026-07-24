import * as React from 'react'

export interface UsePaginationOptions {
  /** 初始总数(默认 0,可后续通过 setTotal 更新;prop 变化会同步到 state) */
  total?: number
  /** 每页大小(默认 10) */
  pageSize?: number
  /** 初始页码(默认 1) */
  initialPage?: number
}

export interface UsePaginationReturn {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
  /** 设置页码(自动 clamp 到 [1, totalPages]) */
  setPage: (page: number) => void
  /** 设置每页大小(重置到第 1 页) */
  setPageSize: (size: number) => void
  /** 直接设置总数(用于运行时拉取后更新) */
  setTotal: (total: number) => void
  /** 下一页(到达末页时不再增加) */
  next: () => void
  /** 上一页(到达首页时不再减少) */
  prev: () => void
  /** 重置到第 1 页 */
  reset: () => void
}

/**
 * 分页纯状态 Hook(无列表管理,无平台依赖)
 *
 * 各端可扩展包装,加入 list/loading/appendList 等列表管理逻辑。
 *
 * 用法:
 * ```ts
 * // 直接使用(web 端:total 作为输入)
 * const { page, totalPages, setPage } = usePagination({ total: 100, pageSize: 10 })
 *
 * // 扩展使用(miniapp-taro 端:加入 list 管理)
 * function usePagination<T>(opts) {
 *   const base = useSharedPagination({ total: 0, ...opts })
 *   const [list, setList] = useState<T[]>([])
 *   return { ...base, list, setList: (l, t) => { setList(l); base.setTotal(t) } }
 * }
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { total: propTotal = 0, pageSize = 10, initialPage = 1 } = options
  const [page, setPageState] = React.useState(initialPage)
  const [size, setSize] = React.useState(pageSize)
  const [total, setTotalState] = React.useState(propTotal)

  // Sync total when prop changes(web 端用法:total 作为受控输入)
  React.useEffect(() => {
    setTotalState(propTotal)
  }, [propTotal])

  const totalPages = Math.max(1, Math.ceil(total / size))

  const setPage = React.useCallback(
    (p: number) => {
      setPageState(Math.min(Math.max(1, p), totalPages))
    },
    [totalPages],
  )

  const setPageSize = React.useCallback((s: number) => {
    setSize(s)
    setPageState(1)
  }, [])

  const next = React.useCallback(() => {
    setPageState((p) => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prev = React.useCallback(() => {
    setPageState((p) => Math.max(p - 1, 1))
  }, [])

  const reset = React.useCallback(() => {
    setPageState(1)
  }, [])

  const setTotal = React.useCallback((t: number) => {
    setTotalState(t)
  }, [])

  return {
    page,
    pageSize: size,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
    setPage,
    setPageSize,
    setTotal,
    next,
    prev,
    reset,
  }
}
