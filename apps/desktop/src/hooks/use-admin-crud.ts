/**
 * useAdminCrud — admin 三件套(Users / Orders / Settings)复用的 CRUD 状态机。
 *
 * 提供统一能力:
 * - list:  触发分页加载、暴露 rows / total / loading / error
 * - reload: 复用当前 params 重新拉取
 * - mutate: 包装异步 mutation(create/update/delete),自动:
 *   1. setMutating(true)
 *   2. 调用传入的 action
 *   3. 失败时 setError 并抛出;成功时 reload
 *
 * 弹窗状态由消费方页面直接 useState 管理(本 hook 不耦合特定 dialog)。
 */
import { useCallback, useEffect, useState } from 'react'

export interface UseAdminCrudOptions<TParams, TRow> {
  /** 拉取列表的异步函数,返回 { list, total } 或抛错 */
  fetcher: (params: TParams) => Promise<{ list: TRow[]; total: number }>
  /** 拉取所需的查询参数(由 useMemo 传入) */
  params: TParams
  /** 拉取失败时是否 console.warn(默认 true) */
  logError?: boolean
}

export interface UseAdminCrudResult<TParams, TRow> {
  rows: TRow[]
  total: number
  loading: boolean
  mutating: boolean
  error: string
  setError: (msg: string) => void
  reload: () => void
  /** 执行一个 mutation;内部会切换 mutating 状态、失败抛错、成功后 reload */
  mutate: <T>(action: () => Promise<T>) => Promise<T>
  /** 手动刷新列表(等同 reload) */
  refresh: () => Promise<void>
  /** 强制重置(可附带新 params) */
  refetch: (nextParams?: TParams) => void
  // 当前生效的 params(供消费者传递给子组件)
  currentParams: TParams
}

export function useAdminCrud<TParams, TRow>(
  options: UseAdminCrudOptions<TParams, TRow>,
): UseAdminCrudResult<TParams, TRow> {
  const { fetcher, params, logError = true } = options
  const [rows, setRows] = useState<TRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState('')
  const [currentParams, setCurrentParams] = useState(params)

  const runFetch = useCallback(
    async (p: TParams) => {
      setLoading(true)
      setError('')
      try {
        const data = await fetcher(p)
        setRows(data.list)
        setTotal(data.total)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '加载失败'
        setError(msg)
        if (logError) console.warn('[useAdminCrud] fetch failed:', e)
      } finally {
        setLoading(false)
      }
    },
    [fetcher, logError],
  )

  useEffect(() => {
    setCurrentParams(params)
    void runFetch(params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)])

  const reload = useCallback(() => {
    void runFetch(currentParams)
  }, [runFetch, currentParams])

  const refresh = useCallback(async () => {
    await runFetch(currentParams)
  }, [runFetch, currentParams])

  const refetch = useCallback(
    (nextParams?: TParams) => {
      if (nextParams) setCurrentParams(nextParams)
      void runFetch(nextParams ?? currentParams)
    },
    [runFetch, currentParams],
  )

  const mutate = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      setMutating(true)
      setError('')
      try {
        const result = await action()
        await runFetch(currentParams)
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : '操作失败'
        setError(msg)
        throw e
      } finally {
        setMutating(false)
      }
    },
    [runFetch, currentParams],
  )

  return {
    rows,
    total,
    loading,
    mutating,
    error,
    setError,
    reload,
    mutate,
    refresh,
    refetch,
    currentParams,
  }
}
