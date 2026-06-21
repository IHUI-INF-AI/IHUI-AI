/**
 * P21.1: Admin 列表页通用 composable
 * 抽取 27 个 admin 文件中重复的列表/分页/搜索模式
 *
 * 用法:
 *   const { keyword, page, size, total, loading, list, reload, onSearch, onPageChange } = useAdminTable({
 *     fetchFn: (params) => adminApi.examQuestionCategory(params),
 *   })
 */
import { ref, type Ref } from 'vue'
import type { ApiResponse } from '@/types'
import type { ListParams } from '@/api/admin'

export interface UseAdminTableOptions<T = any> {
  /** 列表查询函数，接收 { current, size, keyword } 返回分页数据 */
  fetchFn: (params: ListParams) => Promise<ApiResponse<any>>
  /** 默认每页条数，默认 50 */
  defaultSize?: number
  /** 数据提取路径，默认从 res.data.records / res.data.total 提取 */
  dataExtractor?: (res: ApiResponse<any>) => { records: T[]; total: number }
}

export function useAdminTable<T = any>(options: UseAdminTableOptions<T>) {
  const { fetchFn, defaultSize = 50, dataExtractor } = options

  const keyword = ref('')
  const page = ref(1)
  const size = ref(defaultSize)
  const total = ref(0)
  const loading = ref(false)
  const list = ref<T[]>([]) as Ref<T[]>

  const defaultExtractor = (res: ApiResponse<any>): { records: T[]; total: number } => ({
    records: (res.data as any)?.records || [],
    total: (res.data as any)?.total || 0,
  })

  const reload = async () => {
    loading.value = true
    try {
      const res = await fetchFn({ current: page.value, size: size.value, keyword: keyword.value })
      const extractor = dataExtractor || defaultExtractor
      const { records, total: t } = extractor(res)
      list.value = records
      total.value = t
    } catch (e) { console.error(e) } finally {
      loading.value = false
    }
  }

  const onSearch = (k: string) => {
    keyword.value = k
    page.value = 1
    void reload()
  }

  const onPageChange = (p: number, s: number) => {
    page.value = p
    size.value = s
    void reload()
  }

  return {
    keyword,
    page,
    size,
    total,
    loading,
    list,
    reload,
    onSearch,
    onPageChange,
  }
}
