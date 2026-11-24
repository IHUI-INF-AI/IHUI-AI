// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内能力应用 API 客户端(跨端共享,2026-11-13 立)
 *
 * 5 个用户端点:
 *  - GET    /api/capability-apps        当前用户全部应用
 *  - GET    /api/capability-apps/:id    单个应用
 *  - PUT    /api/capability-apps/:id    新建/覆盖(服务端重跑共享校验器)
 *  - DELETE /api/capability-apps/:id    删除
 *  - POST   /api/capability-apps/:id/invoke  执行只读白名单能力
 */

import type {
  CapabilityAppCallArgs,
  CapabilityAppCallName,
  CapabilityAppDeleteResponse,
  CapabilityAppDetailResponse,
  CapabilityAppInvokeResult,
  CapabilityAppListResponse,
  CapabilityAppRecord,
} from '@ihui/types'

import { fetchApi } from '../client.js'

/** 查询当前用户全部能力应用(未登录返回空清单 + authenticated=false) */
export function listCapabilityApps(): Promise<CapabilityAppListResponse> {
  return fetchApi<CapabilityAppListResponse>('/capability-apps').then((res) => {
    if (!res.success) return { apps: [], authenticated: false }
    return res.data
  })
}

/** 查询单个应用;不存在时抛错(404 由调用方决定展示方式) */
export async function getCapabilityApp(id: string): Promise<CapabilityAppRecord> {
  const res = await fetchApi<CapabilityAppDetailResponse>(
    `/capability-apps/${encodeURIComponent(id)}`,
  )
  if (!res.success) throw new Error(res.error)
  return res.data.app
}

/** 新建/覆盖应用(先落库后渲染,调用成功即已生效) */
export async function saveCapabilityApp(app: CapabilityAppRecord): Promise<CapabilityAppRecord> {
  const res = await fetchApi<CapabilityAppDetailResponse>(
    `/capability-apps/${encodeURIComponent(app.id)}`,
    { method: 'PUT', body: JSON.stringify(app) },
  )
  if (!res.success) throw new Error(res.error)
  return res.data.app
}

/** 删除应用 */
export async function deleteCapabilityApp(id: string): Promise<CapabilityAppDeleteResponse> {
  const res = await fetchApi<CapabilityAppDeleteResponse>(
    `/capability-apps/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

/**
 * 执行应用声明过的只读能力。
 *
 * 失败语义(服务端状态码 → 错误):403 未声明/越权,400 参数不合法,404 应用不存在。
 * 调用方只需展示 message —— 文案由服务端给出,客户端不再二次翻译。
 */
export async function invokeCapabilityApp(
  id: string,
  call: CapabilityAppCallName,
  args?: CapabilityAppCallArgs,
): Promise<CapabilityAppInvokeResult> {
  const res = await fetchApi<CapabilityAppInvokeResult>(
    `/capability-apps/${encodeURIComponent(id)}/invoke`,
    { method: 'POST', body: JSON.stringify(args === undefined ? { call } : { call, args }) },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

export type {
  CapabilityAppDeleteResponse,
  CapabilityAppDetailResponse,
  CapabilityAppInvokeResult,
  CapabilityAppListResponse,
  CapabilityAppRecord,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
