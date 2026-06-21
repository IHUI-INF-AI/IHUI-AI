/**
 * 表格导出工具
 * 支持导出为 CSV 和 Excel
 */

import { logger } from './logger'

/**
 * 导出表格为 CSV
 */
export function exportTableToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    logger.warn('No data to export')
    return
  }

  const headers = Object.keys(data[0] as Record<string, unknown>)
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers
        .map(header => {
          const value = (row as Record<string, unknown>)[header]
          // 处理包含逗号的值
          const stringValue = String(value ?? '')
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

/**
 * 导出表格为 Excel
 * 简化版本，实际使用 xlsx 库
 */
export function exportTableToExcel(data: any[], filename: string): void {
  logger.warn('Excel export not fully implemented, using CSV instead')
  exportTableToCSV(data, filename)
}

export default {
  exportTableToCSV,
  exportTableToExcel,
}
