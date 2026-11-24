// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult } from '@ihui/types'
import { fetchApi } from './client.js'

/**
 * 顶层数组响应收口(2026-11-08,同型根因自查 api-client 形状类)。
 *
 * 背景:服务端契约声明 `data: T[]`,但个别序列化路径会把数组派成数字键对象
 * (`{"0":{...},"1":{...}}`,见 docs/tickets/2026-11 的 F-323)。各端拿到 `res.data`
 * 后直接 `.map` / `.filter`,拿到对象就是运行时 TypeError,而且失败点在页面深处。
 *
 * 本函数把「数组」与「数字键对象」都收敛成真正的数组;其余形状显式抛 PayloadShapeError,
 * 不让错误形状继续流进消费方。只改读取侧,不动服务端 —— 服务端修复另行排期。
 */
export class PayloadShapeError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'PayloadShapeError'
  }
}

function isNumericKeyedRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toArrayPayload<T>(value: unknown, label = 'payload'): T[] {
  if (Array.isArray(value)) return value as T[]

  if (isNumericKeyedRecord(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return []
    const indices = keys.map((k) => Number(k))
    const allNumeric = indices.every((n, i) => Number.isInteger(n) && n >= 0 && keys[i] === String(n))
    if (allNumeric) {
      const sorted = [...indices].sort((a, b) => a - b)
      if (sorted.every((n, i) => n === i)) {
        return sorted.map((n) => (value as Record<string, T>)[String(n)] as T)
      }
    }
  }

  throw new PayloadShapeError(
    `${label}: 期望顶层数组,收到 ${Array.isArray(value) ? 'array' : typeof value}`,
  )
}

/** 取数组型端点:成功分支的 data 过形状守卫,失败分支原样返回。 */
export async function fetchArrayApi<T>(
  url: string,
  options?: RequestInit,
): Promise<ApiResult<T[]>> {
  const res = await fetchApi<unknown>(url, options)
  if (!res.success) return res
  return { ...res, data: toArrayPayload<T>(res.data, url) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
