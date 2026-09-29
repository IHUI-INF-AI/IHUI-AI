// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi } from '@/lib/api'

export interface ExportColumn {
  key: string
  title: string
  formatter?: (value: unknown, row: Record<string, unknown>) => string
}

// G-823:单元格可携带不可信的 assistant 生成文本,以 = + - @ 开头(含前导空白/制表符)的值
// 会被 Excel 当公式执行(公式注入)。前缀 ' 令其按文本解析;' 本身不是触发字符 ⇒ 天然幂等。
// 数字原始值是机器生成的正当用法,不得因 -5 以 - 开头被中和。
const FORMULA_INJECTION_RE = /^(?:[\t\r\n]|\s*[=+\-@])/

export function neutralizeFormulaCell(value: unknown): string {
  if (typeof value === 'number') return String(value)
  const text = typeof value === 'string' ? value : String(value ?? '')
  return FORMULA_INJECTION_RE.test(text) ? `'${text}` : text
}

export function exportToExcel(
  filename: string,
  columns: ExportColumn[],
  data: Record<string, unknown>[],
  t?: (key: string) => string,
): void {
  const headers = columns.map((c) => (t ? t(c.title) : c.title)).join('\t')
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key]
        const formatted = c.formatter ? c.formatter(val, row) : String(val ?? '')
        const translated = t && formatted ? t(formatted) : formatted
        // 收口点:先中和再走既有的分隔符清洗(顺序不得反,否则前缀被后续处理吞掉)
        const safe = typeof val === 'number' ? translated : neutralizeFormulaCell(translated)
        return safe.replace(/\t/g, ' ').replace(/\n/g, ' ')
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
  t?: (key: string) => string,
): Promise<boolean> {
  const res = await fetchApi<{ list: Record<string, unknown>[] }>(url)
  if (!res.success) return false
  exportToExcel(filename, columns, res.data.list ?? [], t)
  return true
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
