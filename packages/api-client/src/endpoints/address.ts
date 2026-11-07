// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收货地址端点(2026-11-05 立,门 300 存量 A 类:web / RN 端内直拼 `/api/addresses` 收口)。
 *
 * 后端真值:`apps/api/src/routes/other/address-routes.ts`(前缀 /api)。
 *  - GET    /api/addresses             列表投影把列 recipient_name 投影成 `name`
 *  - POST   /api/addresses             写入体是 zod addressBodySchema,字段名为 `recipientName`
 *  - PUT    /api/addresses/:id         同上,回包 `{ item }`(仍是列名 recipientName)
 *  - DELETE /api/addresses/:id         回 `{ deleted }`
 *  - POST   /api/addresses/:id/default 回 `{ updated }`
 * 读侧与写侧字段名并不对称,故 `Address` 与 `AddressInput` 都保留两端实际用法(取并集)。
 * 本文件只把请求收口到共享传输层(401/续期/超时由 client 统一处理),不做形状归一。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** GET /api/addresses 的行(列徽投影后的 `name`,不是写入体的 `recipientName`)。 */
export interface Address {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault?: boolean
  /** 表有列但 GET 列表投影不带;RN 只在用户显式填写时提交 */
  postalCode?: string | null
}

/**
 * POST/PUT /api/addresses 的写入体。
 * web 侧提交 `name`、RN 侧提交 `recipientName`(对齐 zod addressBodySchema),两个键都收。
 */
export interface AddressInput {
  name?: string
  recipientName?: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  postalCode?: string
  isDefault?: boolean
}

/** POST/PUT 回包 `{ item }` 的数据库行(仍是列名 recipientName)。 */
export interface AddressRecord {
  id: string
  userId: string
  recipientName: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  postalCode: string | null
  isDefault: boolean
}

/** GET /api/addresses —— 当前用户的收货地址列表。 */
export async function listAddresses(): Promise<ApiResult<{ list: Address[] }>> {
  return fetchApi<{ list: Address[] }>('/api/addresses')
}

/** POST /api/addresses —— 新建收货地址。 */
export async function createAddress(
  input: AddressInput,
): Promise<ApiResult<{ item: AddressRecord }>> {
  return fetchApi<{ item: AddressRecord }>('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** PUT /api/addresses/:id —— 更新收货地址。 */
export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<ApiResult<{ item: AddressRecord }>> {
  return fetchApi<{ item: AddressRecord }>(`/api/addresses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** DELETE /api/addresses/:id —— 删除收货地址。 */
export async function deleteAddress(id: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** POST /api/addresses/:id/default —— 设为默认地址。 */
export async function setDefaultAddress(id: string): Promise<ApiResult<{ updated: boolean }>> {
  return fetchApi<{ updated: boolean }>(`/api/addresses/${encodeURIComponent(id)}/default`, {
    method: 'POST',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
