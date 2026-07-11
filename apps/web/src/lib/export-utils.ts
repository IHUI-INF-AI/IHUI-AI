import { fetchApi } from '@/lib/api'

export interface ExportColumn {
  key: string
  title: string
  formatter?: (value: unknown, row: Record<string, unknown>) => string
}

export function exportToExcel(
  filename: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
): void {
  const headers = columns.map((c) => c.title).join('\t')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key]
        const formatted = c.formatter ? c.formatter(val, row) : String(val ?? '')
        return formatted.replace(/\t/g, ' ').replace(/\n/g, ' ')
      })
      .join('\t'),
  )
  const csv = '\uFEFF' + [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportFromApi(
  url: string,
  filename: string,
  columns: ExportColumn[],
): Promise<boolean> {
  const res = await fetchApi<{ list: Record<string, unknown>[] }>(url)
  if (!res.success) return false
  exportToExcel(filename, columns, res.data.list ?? [])
  return true
}
