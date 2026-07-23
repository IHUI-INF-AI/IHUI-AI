/**
 * 三端联动任务调度跨端共享类型(2026-07-23 立)。
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TaskDispatch {
  id: string
  userId: number
  fromDevice: string
  toDevice: string
  command: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  result?: TaskResult
}

export interface TaskResult {
  taskId: string
  status: TaskStatus
  output?: string
  error?: string
  finishedAt: string
}

export interface TaskDispatchRequest {
  toDevice: string
  command: string
}

export interface TaskDispatchResponse {
  task: TaskDispatch
}

export interface TaskResultRequest {
  taskId: string
  status: TaskStatus
  output?: string
  error?: string
}

export interface TaskWsMessage {
  type: 'task-dispatch' | 'task-result' | 'task-progress'
  taskId: string
  payload: TaskDispatch | TaskResult
}

/**
 * 设备在线注册表(2026-07-23 立,P1 设备寻址闭环)。
 *
 * desktop 启动时生成 deviceId + 调 POST /tasks/register-device 注册,
 * 30s 心跳刷新 lastSeen + 60s TTL,过期自动清理。
 * mobile-rn 从 GET /tasks/devices 拉取真实在线设备列表,按真实 deviceId 下发。
 * desktop hook 收到 task-dispatch 后检查 task.toDevice === myDeviceId,实现按设备定向。
 */

/** 设备类型 */
export type TaskDeviceType = 'desktop' | 'web' | 'mobile' | 'cloud' | 'extension' | 'cli'

/** 在线设备信息 */
export interface TaskDevice {
  deviceId: string
  name: string
  type: TaskDeviceType
  lastSeen: string
  online: boolean
}

/** POST /tasks/register-device 请求 */
export interface TaskDeviceRegisterRequest {
  deviceId: string
  name: string
  type: TaskDeviceType
}

/** POST /tasks/register-device 响应 */
export interface TaskDeviceRegisterResponse {
  device: TaskDevice
}

/** GET /tasks/devices 响应 */
export interface TaskDeviceListResponse {
  devices: TaskDevice[]
  total: number
}
