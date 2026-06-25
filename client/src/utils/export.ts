export interface ExportColumn<T> {
  key: keyof T | string
  header: string
  formatter?: (row: T, value: any) => string | number
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const headers = columns.map(col => col.header).join(',')
  
  const rows = data.map(row => {
    return columns.map(col => {
      const value = col.key.toString().includes('.')
        ? getNestedValue(row, col.key.toString())
        : row[col.key as keyof T]
      
      const formattedValue = col.formatter ? col.formatter(row, value) : value
      const stringValue = String(formattedValue ?? '')
      
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  })
  
  const csv = [headers, ...rows].join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${filename}.csv`)
}

export function exportToJSON<T extends Record<string, unknown>>(
  data: T[],
  filename: string
): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
  downloadBlob(blob, `${filename}.json`)
}

export function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const headers = columns.map(col => col.header)
  
  const rows = data.map(row => {
    return columns.map(col => {
      const value = col.key.toString().includes('.')
        ? getNestedValue(row, col.key.toString())
        : row[col.key as keyof T]
      
      return col.formatter ? col.formatter(row, value) : value ?? ''
    })
  })
  
  let tableHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">'
  tableHtml += '<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>'
  tableHtml += '<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>'
  tableHtml += '<body><table border="1">'
  
  tableHtml += '<thead><tr>'
  headers.forEach(header => {
    tableHtml += `<th style="background-color: var(--color-gray-light); font-weight: 700;">${escapeHtml(String(header))}</th>`
  })
  tableHtml += '</tr></thead>'
  
  tableHtml += '<tbody>'
  rows.forEach(row => {
    tableHtml += '<tr>'
    row.forEach(cell => {
      tableHtml += `<td>${escapeHtml(String(cell))}</td>`
    })
    tableHtml += '</tr>'
  })
  tableHtml += '</tbody></table></body></html>'
  
  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  downloadBlob(blob, `${filename}.xls`)
}

function getNestedValue(obj: Record<string, unknown>, path: string): any {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return str.replace(/[&<>"']/g, char => htmlEntities[char] || char)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatDateForExport(date: Date | string | number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function generateExportFilename(prefix: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
  return `${prefix}_${dateStr}_${timeStr}`
}
