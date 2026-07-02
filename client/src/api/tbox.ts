/**
 * TBox 设备管理 API
 * 对接后端: app/api/v1/tbox/tbox.py (设备/指令) + app/api/v1/mcp/tbox.py (通知/事件)
 * 路由前缀: /api/v1/tbox
 *
 * 后端列表响应为 {code, msg, data:[...], total},
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

/** TBox 设备 */
export interface TboxDevice {
  deviceNo: string
  deviceName?: string | null
  deviceType: string
  model?: string | null
  brand?: string | null
  iccid?: string | null
  imei?: string | null
  firmware?: string | null
  userId?: string | null
  userName?: string | null
  status: number
  isOnline: boolean
  createTime?: string | null
}

/** TBox 控制指令 */
export interface TboxCommand {
  id: number
  deviceNo: string
  command: string
  params?: string | null
  status: number
  createTime?: string | null
}

/** TBox 通知事件 */
export interface TboxNotifyEvent {
  id: string | number
  eventType: string
  payload: Record<string, unknown>
  timestamp?: string | null
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 设备管理 (tbox/tbox.py)
// ===========================================================================

/** 设备列表 */
export async function tboxDeviceList(params: {
  page?: number
  limit?: number
  userId?: string
  deviceType?: string
  status?: number
  isOnline?: boolean
}): Promise<ApiResponse<PaginationResponse<TboxDevice>>> {
  const res = await http.get('/api/v1/tbox/device/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      user_id: params.userId || undefined,
      device_type: params.deviceType || undefined,
      status: params.status,
      is_online: params.isOnline,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<TboxDevice>>
}

/** 设备详情 */
export async function tboxDeviceDetail(deviceNo: string): Promise<ApiResponse<TboxDevice | null>> {
  const res = await http.get(`/api/v1/tbox/device/${deviceNo}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<TboxDevice | null>
}
/** 注册设备 (后端使用 Query 参数) */
export async function tboxRegisterDevice(params: {
  deviceNo: string
  deviceName?: string
  deviceType?: string
  model?: string
  brand?: string
  iccid?: string
  imei?: string
  firmware?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tbox/device', null, {
    params: {
      device_no: params.deviceNo,
      device_name: params.deviceName || undefined,
      device_type: params.deviceType || 'tbox',
      model: params.model || undefined,
      brand: params.brand || undefined,
      iccid: params.iccid || undefined,
      imei: params.imei || undefined,
      firmware: params.firmware || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 激活设备 (后端使用 Query 参数) */
export async function tboxActivateDevice(deviceNo: string, params: {
  userId: string
  userName?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post(`/api/v1/tbox/device/${deviceNo}/activate`, null, {
    params: {
      user_id: params.userId,
      user_name: params.userName || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 设备心跳 (后端使用 Query 参数) */
export async function tboxHeartbeat(params: {
  deviceNo: string
  isOnline?: boolean
  signalStrength?: number
  battery?: number
  location?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tbox/device/heartbeat', null, {
    params: {
      device_no: params.deviceNo,
      is_online: params.isOnline,
      signal_strength: params.signalStrength ?? 0,
      battery: params.battery ?? 0,
      location: params.location || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 下发指令 (后端使用 Query 参数) */
export async function tboxSendCommand(deviceNo: string, params: {
  command: string
  params?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post(`/api/v1/tbox/device/${deviceNo}/command`, null, {
    params: {
      command: params.command,
      params: params.params || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}
/** 指令列表 */
export async function tboxCommandList(params: {
  page?: number
  limit?: number
  deviceNo?: string
  status?: number
}): Promise<ApiResponse<PaginationResponse<TboxCommand>>> {
  const res = await http.get('/api/v1/tbox/command/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      device_no: params.deviceNo || undefined,
      status: params.status,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.data || [], body.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<TboxCommand>>
}

// ===========================================================================
// 通知事件 (mcp/tbox.py)
// ===========================================================================

/** 接收 TBox 事件通知 (Body 传负载, Headers 传签名) */
export async function tboxReceiveNotify(payload: object, headers: {
  xSignature?: string
  xTimestamp?: string
}): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tbox/notify', payload, {
    headers: {
      'X-Signature': headers.xSignature || undefined,
      'X-Timestamp': headers.xTimestamp || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 查询最近 TBox 事件 */
export async function tboxRecentEvents(params: {
  limit?: number
}): Promise<ApiResponse<TboxNotifyEvent[]>> {
  const res = await http.get('/api/v1/tbox/events', {
    params: {
      limit: params.limit ?? 50,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<TboxNotifyEvent[]>
}

export const tboxApi = {
  tboxDeviceList,
  tboxDeviceDetail,
  tboxRegisterDevice,
  tboxActivateDevice,
  tboxHeartbeat,
  tboxSendCommand,
  tboxCommandList,
  tboxReceiveNotify,
  tboxRecentEvents,
}

export default tboxApi