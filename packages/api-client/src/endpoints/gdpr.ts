// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GDPR 数据权利端点(2026-11-05 立,门 300 存量裁决 A 类)。
 *
 * 后端真源:`apps/api/src/routes/gdpr.ts`(prefix `/api`),三条都是 **POST**:
 *  - POST /api/gdpr/export       → 用户数据导出
 *  - POST /api/gdpr/portability  → 机器可读可携带导出(注意是 POST,不是 GET)
 *  - POST /api/gdpr/erase        → 软删 + PII 匿名化 + 吊销 refresh token
 *
 * 三端同语义(web `(main)/settings/data-rights`、RN `DataRightsScreen`),故收口共享库,
 * 401 弹窗由端侧 `setUnauthorizedHandler` 注入、续期/超时由共享 client 统一处理。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 用户基础档案(export 返回的 user 字段)。 */
export interface GdprExportUser {
  id: string
  phone: string | null
  email: string | null
  username: string | null
  nickname: string | null
  avatar: string | null
  bio: string | null
  gender: number
  birthday: string | null
  status: number
  createdAt: string
  updatedAt: string
}

export interface GdprExportSearchItem {
  id: string
  query: string
  resultsCount: number
  createdAt: string
}

export interface GdprExportAuditItem {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

/** POST /api/gdpr/export 返回的 data 结构。 */
export interface GdprExportData {
  user: GdprExportUser
  searchHistory: GdprExportSearchItem[]
  auditLogs: GdprExportAuditItem[]
}

/** portability 返回的 subject 结构。 */
export interface GdprPortabilitySubject {
  id: string
  identifier: string | null
}

export interface GdprPortabilityProfile {
  username: string | null
  nickname: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  bio: string | null
  gender: number | null
  birthday: string | null
  createdAt: string
  updatedAt: string
}

export interface GdprPortabilitySearchItem {
  query: string
  resultsCount: number
  createdAt: string
}

export interface GdprPortabilityAuditItem {
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

/** POST /api/gdpr/portability 返回的 data 结构(机器可读的 GDPR 可携带导出)。 */
export interface GdprPortabilityData {
  schema: string
  exportedAt: string
  subject: GdprPortabilitySubject
  data: {
    profile: GdprPortabilityProfile
    searchHistory: GdprPortabilitySearchItem[]
    auditTrail: GdprPortabilityAuditItem[]
    /** 以下为后端按账号实际数据附带的可选区块(RN 数据权利屏逐项计数)。 */
    notes?: unknown[]
    memories?: unknown[]
    chat?: { conversations?: unknown[]; messageCount?: number }
    addresses?: unknown[]
    orders?: unknown[]
  }
}

/** POST /api/gdpr/erase 返回的 data 结构。 */
export interface GdprEraseData {
  erased: boolean
  userId: string
}

/** POST /api/gdpr/export —— 导出当前用户数据。 */
export async function exportGdprData(): Promise<ApiResult<GdprExportData>> {
  return fetchApi<GdprExportData>('/api/gdpr/export', { method: 'POST' })
}

/** POST /api/gdpr/portability —— 机器可读的可携带导出。 */
export async function getGdprPortabilityData(): Promise<ApiResult<GdprPortabilityData>> {
  return fetchApi<GdprPortabilityData>('/api/gdpr/portability', { method: 'POST' })
}

/** POST /api/gdpr/erase —— 擦除账号(服务端匿名化并吊销 refresh token)。 */
export async function eraseGdprAccount(): Promise<ApiResult<GdprEraseData>> {
  return fetchApi<GdprEraseData>('/api/gdpr/erase', { method: 'POST' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
