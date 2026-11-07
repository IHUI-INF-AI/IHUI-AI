// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全治理端点(2026-11-05 立,门 300 存量裁决 A 类:web / RN 端内直拼 `/api/security` 收口)。
 *
 * 后端真值:`apps/api/src/routes/security.ts`(index.ts:1314 以 `/api/security` 前缀注册)
 * 与 `apps/api/src/routes/other/audit-routes.ts` 的 `GET /security/audit`。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** 异常事件推荐处置档位。 */
export type SecurityAnomalyRecommendation = 'block' | 'monitor' | 'allow'

export interface SecurityAnomalyDimension {
  name: string
  score: number
  weight: number
}

export interface SecurityAnomalyEvent {
  timestamp: number
  ip: string
  userId: string | null
  url: string
  score: number
  recommendation: SecurityAnomalyRecommendation
  dimensions: SecurityAnomalyDimension[]
}

export interface SecurityAnomalyListData {
  total: number
  list: SecurityAnomalyEvent[]
}

/** GET /api/security/anomalies 的查询参数(后端 anomaliesQuerySchema)。 */
export interface SecurityAnomalyQuery {
  limit?: number
  offset?: number
  minScore?: number
  ip?: string
}

export interface IpReputation {
  score: number
  reasons: string[]
  source: 'cache' | 'live'
}

export interface BlockIpInput {
  ip: string
  duration: number
  reason?: string
}

export interface BlockIpData {
  ip: string
  duration: number
  blocked: boolean
}

export interface UnblockIpData {
  ip: string
  blocked: false
}

export interface SecurityWatchedIp {
  ip: string
  score: number
  reasons: string[]
  lastSeen: number
}

export interface SecurityRecentBlock {
  ip: string
  score: number
  duration: string
  timestamp: number
}

export interface ThreatDashboardData {
  totalChecks: number
  totalAutoBlocks: number
  totalWarnings: number
  watchedIps: SecurityWatchedIp[]
  recentBlocks: SecurityRecentBlock[]
}

/** GET /api/security/audit 的行(security_logs 表投影;ip/userAgent 可为 null)。 */
export interface SecurityLogEntry {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface SecurityAuditData {
  list: SecurityLogEntry[]
  total: number
  page?: number
  pageSize?: number
}

/** GET /api/security/anomalies —— 异常事件列表(仅 admin)。 */
export async function listSecurityAnomalies(
  query: SecurityAnomalyQuery = {},
): Promise<ApiResult<SecurityAnomalyListData>> {
  return fetchApi<SecurityAnomalyListData>(`/api/security/anomalies${buildQs(query)}`)
}

/** GET /api/security/ip-reputation/:ip —— 查询 IP 信誉(仅 admin)。 */
export async function getIpReputation(ip: string): Promise<ApiResult<IpReputation>> {
  return fetchApi<IpReputation>(`/api/security/ip-reputation/${encodeURIComponent(ip)}`)
}

/** POST /api/security/block-ip —— 封禁 IP(仅 admin)。 */
export async function blockIp(input: BlockIpInput): Promise<ApiResult<BlockIpData>> {
  return fetchApi<BlockIpData>('/api/security/block-ip', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** DELETE /api/security/block-ip/:ip —— 解封 IP(仅 admin)。 */
export async function unblockIp(ip: string): Promise<ApiResult<UnblockIpData>> {
  return fetchApi<UnblockIpData>(`/api/security/block-ip/${encodeURIComponent(ip)}`, {
    method: 'DELETE',
  })
}

/** GET /api/security/threat-dashboard —— 威胁监控仪表盘(仅 admin)。 */
export async function getThreatDashboard(): Promise<ApiResult<ThreatDashboardData>> {
  return fetchApi<ThreatDashboardData>('/api/security/threat-dashboard')
}

/** GET /api/security/audit —— 当前用户的安全审计日志。 */
export async function getSecurityAudit(): Promise<ApiResult<SecurityAuditData>> {
  return fetchApi<SecurityAuditData>('/api/security/audit')
}
