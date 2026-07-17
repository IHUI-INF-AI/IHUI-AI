'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'

export interface DictItem {
  label: string
  value: string
  sort?: number
}

const DICT_STALE_TIME = 30 * 60 * 1000

interface DictDataResponse {
  dictType: string
  list: Array<{ dictLabel: string; dictValue: string; dictSort?: number }>
}

export function useDictType(typeCode: string) {
  return useQuery({
    queryKey: ['dict', typeCode],
    queryFn: async (): Promise<DictItem[]> => {
      const r = await fetchApi<DictDataResponse>(
        `/api/admin/dict/data/type/${encodeURIComponent(typeCode)}`,
      )
      if (!r.success || !r.data) return []
      return (r.data.list ?? []).map((d) => ({
        label: d.dictLabel,
        value: d.dictValue,
        sort: d.dictSort,
      }))
    },
    staleTime: DICT_STALE_TIME,
    enabled: !!typeCode,
    retry: false,
  })
}

export function useDictLabel(typeCode: string, value: string) {
  const { data } = useDictType(typeCode)
  return data?.find((item) => item.value === value)?.label ?? value
}
