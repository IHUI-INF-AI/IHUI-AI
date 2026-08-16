/**
 * 教育相关 API(2026-07-27 立)
 *
 * 当前仅封装"学习报告导出"端点(POST /api/edu/my-report/export):
 * - 响应可能是 JSON(StudentReportData)或二进制文件流(pdf / xlsx),
 *   不能走 fetchApi 的 JSON 协议路径(会因 code 字段缺失被判定失败);
 * - 这里复用 fetchApi 的 token 注入 + URL 规范化,但保留原生 fetch 返回 Response,
 *   让调用方自行根据 Content-Type 处理 blob 下载或 JSON 解析。
 *
 * 后端路由:apps/api/src/routes/edu-public.ts:605(POST /api/edu/my-report/export)
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi, getToken, normalizeUrlPublic } from '../client'

export type ReportFormat = 'pdf' | 'excel' | 'json'

export interface ReportConfig {
  format: ReportFormat
  dateRange?: { start: string; end: string }
}

/**
 * 导出学习报告 — POST /api/edu/my-report/export
 *
 * 返回原生 Response(不走 fetchApi 的 JSON 协议路径),调用方需自行:
 *   - 检查 `response.ok`
 *   - 根据 Content-Type 走 blob 下载(pdf/excel)或 json 解析(json)
 *
 * token + URL 规范化由本函数统一处理(与 fetchApi 一致),无需调用方手动传 Authorization。
 */
export async function exportMyReport(
  config: ReportConfig,
  init?: { signal?: AbortSignal },
): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const url = normalizeUrlPublic('/api/edu/my-report/export')
  return fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(config),
    credentials: 'include',
    signal: init?.signal,
  })
}

/**
 * 导出学习报告(JSON 模式便捷封装) — 仅适用于 format='json'
 *
 * 内部调用 fetchApi,返回 ApiResult<StudentReportData>;失败抛 ApiResult.error。
 * pdf/excel 模式请用 exportMyReport 拿原生 Response 自行处理 blob 下载。
 */
export async function exportMyReportJson<T = unknown>(config: ReportConfig): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/edu/my-report/export', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}
