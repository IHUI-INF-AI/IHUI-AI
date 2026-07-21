/**
 * 浏览器降级 API 端点(2026-07-22 立,P1 WorkPanel iframe 降级)
 *
 * 用于:
 *  - 前端 iframe 加载失败 → 探测是否可嵌入(/probe)
 *  - 不可嵌入 → 调截图 API 获取 base64(/screenshot)
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 截图请求(契约与 @ihui/types ScreenshotRequest 一致) */
export interface ScreenshotRequest {
  url: string
  width?: number
  height?: number
  fullPage?: boolean
  waitUntil?: 'none' | 'dom' | 'load' | 'networkidle'
  timeout?: number
}

/** 截图响应(契约与 @ihui/types ScreenshotResponse 一致) */
export interface ScreenshotResponse {
  /** base64 编码的 PNG 截图(不含 data: 前缀) */
  screenshot: string
  /** 页面标题 */
  title: string
  /** 最终 URL(可能因重定向变化) */
  url: string
  /** 是否可 iframe 嵌入(true=可以,false=需要用截图模式) */
  canEmbed: boolean
  /** 截图时间戳 */
  capturedAt: number
}

/** URL 嵌入探测响应 */
export interface ProbeEmbedResponse {
  url: string
  canEmbed: boolean
}

/**
 * 对指定 URL 截图(经 api 层转发到 ai-service Playwright)。
 * 用于 iframe 加载失败时的降级展示。
 */
export async function takeScreenshot(
  req: ScreenshotRequest,
): Promise<ApiResult<ScreenshotResponse>> {
  return fetchApi<ScreenshotResponse>('/api/browser/screenshot', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

/**
 * 探测 URL 是否可 iframe 嵌入(检查 X-Frame-Options / CSP frame-ancestors)。
 * 用于 iframe 加载前预判是否需要直接走截图模式。
 */
export async function probeEmbed(url: string): Promise<ApiResult<ProbeEmbedResponse>> {
  return fetchApi<ProbeEmbedResponse>('/api/browser/probe', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}
