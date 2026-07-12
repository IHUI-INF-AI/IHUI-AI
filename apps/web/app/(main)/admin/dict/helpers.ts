import { fetchApi } from '@/lib/api'
import type { DictItem, DictType, TypeForm, ItemForm } from './types'

export const EMPTY_TYPE: TypeForm = { name: '', code: '', description: '' }
export const EMPTY_ITEM: ItemForm = { label: '', value: '', sort: 0 }

export const th = 'px-4 py-2.5 font-medium'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EXPORT_COLUMNS = [
  { key: 'typeName', title: '字典名称' },
  { key: 'typeCode', title: '字典编码' },
  { key: 'label', title: '字典标签' },
  { key: 'value', title: '字典值' },
  { key: 'sort', title: '排序' },
]

export async function fetchDictList(): Promise<DictType[]> {
  const r = await fetchApi<{
    list: { dictId: number; dictName: string; dictType: string; remark?: string | null }[]
  }>('/api/admin/dict/type/list')
  if (!r.success) throw new Error(r.error)
  const result: DictType[] = await Promise.all(
    (r.data?.list ?? []).map(async (t) => {
      const dr = await fetchApi<{
        list: { dictCode: number; dictLabel: string; dictValue: string; dictSort?: number }[]
      }>(`/api/admin/dict/data/type/${t.dictType}`)
      const items: DictItem[] =
        dr.success && dr.data?.list
          ? dr.data.list.map((d) => ({
              id: String(d.dictCode),
              label: d.dictLabel,
              value: d.dictValue,
              sort: d.dictSort ?? 0,
            }))
          : []
      return {
        id: String(t.dictId),
        name: t.dictName,
        code: t.dictType,
        description: t.remark ?? '',
        itemCount: items.length,
        items,
      }
    }),
  )
  return result
}

export function filterDictList(list: DictType[], search: string): DictType[] {
  if (!search.trim()) return list
  const q = search.toLowerCase()
  return list.filter((d) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
}

export function buildDictExportRows(list: DictType[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  list.forEach((d) => {
    if (d.items.length === 0) {
      rows.push({ typeName: d.name, typeCode: d.code, label: '', value: '', sort: '' })
    } else {
      d.items.forEach((it) => {
        rows.push({
          typeName: d.name,
          typeCode: d.code,
          label: it.label,
          value: it.value,
          sort: it.sort,
        })
      })
    }
  })
  return rows
}
