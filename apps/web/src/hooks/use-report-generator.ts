'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'

export type ReportFormat = 'pdf' | 'excel' | 'json'

export interface ReportConfig {
  format: ReportFormat
  dateRange?: { start: string; end: string }
}

export interface UseReportGeneratorReturn {
  /** 触发导出,返回下载 URL 或 json 数据;失败返回 null */
  exportReport: (config: ReportConfig) => Promise<{ downloadUrl?: string; data?: unknown } | null>
  generating: boolean
  error: Error | null
  reset: () => void
}

/**
 * 一键导出学习报告 Hook
 *
 * 调用 POST /api/edu/my-report/export (后端 edu-public.ts:605),
 * 后端根据 format 返回:
 *  - json: { code: 0, data: StudentReportData }
 *  - pdf/excel: 二进制文件流(Content-Type: application/pdf 或 xlsx)
 *
 * Hook 内部根据 format 处理:
 *  - json: 解析 json 拿 data
 *  - pdf/excel: 转 blob + 创建临时 a 标签触发浏览器下载
 */
export function useReportGenerator(): UseReportGeneratorReturn {
  const mutation = useMutation({
    mutationFn: async (config: ReportConfig) => {
      const resp = await fetch('/api/edu/my-report/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        credentials: 'include',
      })
      if (!resp.ok) {
        throw new Error(`导出失败: ${resp.status} ${resp.statusText}`)
      }
      const contentType = resp.headers.get('Content-Type') ?? ''

      // 文件流(pdf/excel)→ blob 下载
      if (contentType.includes('application/pdf') || contentType.includes('spreadsheetml')) {
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        // 从 Content-Disposition 解析文件名
        const cd = resp.headers.get('Content-Disposition') ?? ''
        const match = /filename="?([^";]+)"?/.exec(cd)
        const filename = match?.[1] ?? `student-report.${config.format === 'pdf' ? 'pdf' : 'xlsx'}`
        // 创建临时 a 标签触发浏览器下载
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // 释放 blob URL(延迟 1 秒以保障下载已开始)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        return { downloadUrl: url }
      }

      // JSON 数据
      const json = (await resp.json()) as { code: number; data?: unknown; message?: string }
      if (json.code !== 0) {
        throw new Error(json.message ?? '导出失败')
      }
      return { data: json.data }
    },
  })

  const exportReport = React.useCallback(
    async (config: ReportConfig) => {
      try {
        return await mutation.mutateAsync(config)
      } catch {
        return null
      }
    },
    [mutation],
  )

  return {
    exportReport,
    generating: mutation.isPending,
    error: mutation.error as Error | null,
    reset: mutation.reset,
  }
}
