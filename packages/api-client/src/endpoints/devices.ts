// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ApiResult, RegisterDeviceTokenInput, RegisterDeviceTokenResponse } from '@ihui/types'

import { fetchApi, normalizeUrlPublic } from '../client.js'
import { getTransport } from '../transport.js'

/**
 * 设备推送令牌端点(2026-09-06 立,mobile-cap 推送链路,跨端共享)
 *
 * 后端契约(apps/api/src/routes/devices.ts):
 * - PUT /api/devices/token:需登录(Bearer),按 token 唯一约束 upsert,
 *   FCM token 轮换重复上报安全,返回 { token, platform, registered: true }
 * - DELETE /api/devices/token:需登录,仅置 isActive=false(审计保留),返回 { unregistered: true }
 *
 * 失败时静默返回 null/false,不阻断 App 主流程(推送令牌上报属尽力而为)。
 */
export const deviceEndpoints = {
  /** 注册/更新当前用户的推送设备令牌 — PUT /api/devices/token(失败静默) */
  registerToken: async (
    input: RegisterDeviceTokenInput,
  ): Promise<RegisterDeviceTokenResponse | null> => {
    try {
      const res = await fetchApi<RegisterDeviceTokenResponse>('/api/devices/token', {
        method: 'PUT',
        body: JSON.stringify(input),
      })
      if (res.success && res.data) {
        return res.data
      }
      return null
    } catch {
      return null
    }
  },

  /** 注销当前用户的推送设备令牌 — DELETE /api/devices/token(失败静默) */
  unregisterToken: async (token: string): Promise<boolean> => {
    try {
      const res = await fetchApi<{ token: string; unregistered: boolean }>('/api/devices/token', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      })
      return res.success
    } catch {
      return false
    }
  },
}

/**
 * G1 跨设备互联闭环端点封装(2026-10-30 立,对应 api 侧 /api/devices/* 与
 * POST /api/chat/sessions/:id/delegate)。
 *
 * 两个令牌面:
 * - 用户面(registerDevice/listDevices/revokeDevice/issuePairCode/getDeviceTasks/delegateSession)
 *   走 fetchApi 默认人 JWT;
 * - 设备面(heartbeat/claim/progress/complete/fail)带 pair-exchange 兑换回的短期设备
 *   bearer token。设备面一律走本文件私有 fetchDeviceApi(原生 transport + 信封解析):
 *   fetchApi 会在宿主已登录时强制覆盖 Authorization 为人 JWT,设备令牌必须豁免该覆盖;
 *   且 GET /devices/claim 的 204 空响应在 fetchApi 的 response.json() 上会炸。
 */

// =============================================================================
// Types(与 apps/api services/device-service.ts 响应形状对齐)
// =============================================================================

/** 设备能力描述(自由 jsonb,如 {roles:["desktop","cli"],workspaces:[...]}) */
export type DeviceCapabilities = Record<string, unknown>

/** devices 行(服务端 drizzle camelCase) */
export interface DeviceRow {
  id: string
  userId: string
  name: string
  os: string | null
  capabilities: DeviceCapabilities | null
  lastSeenAt: string
  createdAt: string
  revokedAt: string | null
  /** 仅 GET /api/devices 附带:last_seen_at 距今 <90s */
  online?: boolean
}

/** device_tasks 行 */
export interface DeviceTaskRow {
  id: string
  sessionId: string
  targetDeviceId: string
  status: 'queued' | 'claimed' | 'running' | 'completed' | 'failed' | 'expired'
  claimedAt: string | null
  finishedAt: string | null
  error: string | null
  resultSummary: unknown
  createdAt: string
  createdBy: string
}

// =============================================================================
// 用户令牌面
// =============================================================================

/** 注册/幂等刷新设备(同 user+name 重复注册 = 更新 last_seen 并返回原行) */
export async function registerDevice(payload: {
  name: string
  os?: string | null
  capabilities?: DeviceCapabilities | null
}): Promise<ApiResult<DeviceRow>> {
  return fetchApi<DeviceRow>('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
}

/** 当前用户设备列表(附 online 判定,不含已撤销) */
export async function listDevices(): Promise<ApiResult<DeviceRow[]>> {
  return fetchApi<DeviceRow[]>('/api/devices', { method: 'GET' })
}

/** 撤销设备(置 revoked_at) */
export async function revokeDevice(
  deviceId: string,
): Promise<ApiResult<{ id: string; revoked: boolean }>> {
  return fetchApi<{ id: string; revoked: boolean }>(
    `/api/devices/${encodeURIComponent(deviceId)}`,
    {
      method: 'DELETE',
    },
  )
}

/** 签发 6 位数字配对码(TTL 5 分钟、单次使用、每用户 10 次/小时;明文只回一次) */
export async function issuePairCode(): Promise<ApiResult<{ code: string; expires_at: string }>> {
  return fetchApi<{ code: string; expires_at: string }>('/api/devices/pair-code', {
    method: 'POST',
  })
}

/**
 * 配对码兑换设备令牌(无需人令牌:码即凭据)。
 * name/os/capabilities 可选,兑换即注册设备行;码错 400、过期/已用 410。
 */
export async function pairExchangeDevice(payload: {
  code: string
  name?: string
  os?: string | null
  capabilities?: DeviceCapabilities | null
}): Promise<ApiResult<{ device_token: string; device_id: string }>> {
  return fetchApi<{ device_token: string; device_id: string }>('/api/devices/pair-exchange', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/** 会话委托到设备(离线允许入队)。主路径 /api/chat/sessions/:id/delegate */
export async function delegateSession(
  sessionId: string,
  targetDeviceId: string,
): Promise<ApiResult<{ task_id: string; status: 'queued' }>> {
  return fetchApi<{ task_id: string; status: 'queued' }>(
    `/api/chat/sessions/${encodeURIComponent(sessionId)}/delegate`,
    { method: 'POST', body: JSON.stringify({ target_device_id: targetDeviceId }) },
  )
}

/** 某设备的待办/历史任务(用户令牌面;跨用户 404) */
export async function getDeviceTasks(deviceId: string): Promise<ApiResult<DeviceTaskRow[]>> {
  return fetchApi<DeviceTaskRow[]>(`/api/devices/${encodeURIComponent(deviceId)}/tasks`, {
    method: 'GET',
  })
}

// =============================================================================
// 设备令牌面(私有 fetchDeviceApi:设备令牌优先于宿主人 JWT,且兼容 204)
// =============================================================================

interface Envelope<T> {
  code: number
  message?: string
  data?: T
  errorCode?: string
}

/** 设备面统一请求:Bearer deviceToken,解析 {code:0,data} 信封;204 → data=null */
async function fetchDeviceApi<T>(
  deviceToken: string,
  path: string,
  init: { method: string; body?: string } = { method: 'GET' },
): Promise<ApiResult<T>> {
  const url = normalizeUrlPublic(path)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${deviceToken}`,
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await getTransport()(url, { method: init.method, headers, body: init.body })
  if (response.status === 204) return { success: true, data: null as T, status: 204 }
  const text = await response.text().catch(() => '')
  let envelope: Envelope<T> | null = null
  try {
    envelope = text ? (JSON.parse(text) as Envelope<T>) : null
  } catch {
    envelope = null
  }
  if (!response.ok) {
    return {
      success: false,
      error: envelope?.message?.trim() || `请求失败(${response.status})`,
      status: response.status,
      errorCode: envelope?.errorCode,
    }
  }
  if (!envelope || envelope.code !== 0) {
    return {
      success: false,
      error: envelope?.message?.trim() || '请求失败',
      status: response.status,
      errorCode: envelope?.errorCode,
    }
  }
  return { success: true, data: envelope.data as T, status: response.status }
}

/** 心跳:刷新 last_seen_at;响应回发续期后的新设备令牌(建议持久化替换) */
export async function deviceHeartbeat(
  deviceToken: string,
): Promise<ApiResult<{ last_seen_at: string; device_token: string }>> {
  return fetchDeviceApi(deviceToken, '/api/devices/heartbeat', { method: 'POST' })
}

/** 原子认领最早 queued 任务;无可认领 → data=null(服务端 204) */
export async function deviceClaimNextTask(
  deviceToken: string,
): Promise<ApiResult<DeviceTaskRow | null>> {
  return fetchDeviceApi<DeviceTaskRow | null>(deviceToken, '/api/devices/claim', { method: 'GET' })
}

/** 上报进度(running 态更新 result_summary) */
export async function deviceTaskProgress(
  deviceToken: string,
  taskId: string,
  summary: DeviceCapabilities,
): Promise<ApiResult<DeviceTaskRow>> {
  return fetchDeviceApi<DeviceTaskRow>(
    deviceToken,
    `/api/devices/tasks/${encodeURIComponent(taskId)}/progress`,
    { method: 'POST', body: JSON.stringify({ summary }) },
  )
}

/** 上报完成(终态) */
export async function deviceTaskComplete(
  deviceToken: string,
  taskId: string,
  summary?: DeviceCapabilities | null,
): Promise<ApiResult<DeviceTaskRow>> {
  return fetchDeviceApi<DeviceTaskRow>(
    deviceToken,
    `/api/devices/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST', body: JSON.stringify(summary !== null ? { summary } : {}) },
  )
}

/** 上报失败(终态) */
export async function deviceTaskFail(
  deviceToken: string,
  taskId: string,
  error?: string,
  summary?: DeviceCapabilities | null,
): Promise<ApiResult<DeviceTaskRow>> {
  return fetchDeviceApi<DeviceTaskRow>(
    deviceToken,
    `/api/devices/tasks/${encodeURIComponent(taskId)}/fail`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...(error ? { error } : {}),
        ...(summary !== null ? { summary } : {}),
      }),
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
