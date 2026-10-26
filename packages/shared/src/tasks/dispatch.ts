// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 三端联动任务调度跨端共享类型(2026-07-23 立)。
 * mobile-rn 下发 → api WebSocket → desktop 接收执行 → 结果回推。
 */

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 跨端文件传输载荷(2026-07-24 立,P2-c 跨端文件传输缺口)。
 * mobile-rn 下发 → api 存储 + WS 推送 → desktop 接收 + 下载。
 * content 为 base64 编码字符串,大小限制 1MB(解码后字节数)。
 */
export interface TaskFilePayload {
  filename: string
  size: number
  mimeType: string
  /** base64 编码的文件内容 */
  content: string
}

/**
 * 委派审批票(2026-10-26 立)。
 * 类型定义与判据在 `./delegation-approval.js`(纯函数、零依赖),此处只做类型再出口,
 * 避免消费端各自 import 深层路径。
 */
export type { DelegationApprovalTicket, DelegationApprovalState } from './delegation-approval.js'
import type { DelegationApprovalTicket } from './delegation-approval.js'

export interface TaskDispatch {
  id: string
  /** 用户 ID(UUID 字符串)。原类型为 number,但 `Number(UUID)` 返回 NaN,2026-08-01 修正为 string。 */
  userId: string
  /**
   * 委派**发起**设备(提问的那台)。
   *
   * 2026-10-26 修正:此前路由侧恒写 `'api'`,导致发起设备身份丢失 ——
   * 于是"审批卡送回提问的那台设备"无从实现(这正是与 nanoMuse 对比出的 P0-1 缺口)。
   * 现在由调用方传真实 deviceId;缺省回落 `'api'` 仅为兼容既有客户端,
   * **回落时该委派不给任何设备答票权**(审批票两端为空 ⇒ 无人可答 ⇒ 只能走免审路径)。
   */
  fromDevice: string
  toDevice: string
  command: string
  status: TaskStatus
  createdAt: string
  updatedAt: string
  result?: TaskResult
  /** 可选附件(2026-07-24 立,P2-c 跨端文件传输) */
  filePayload?: TaskFilePayload
  /**
   * 委派审批票(2026-10-26 立)。**只在 `requireApproval` 下发时存在**。
   *
   * 审批态是**叠在委派上的一维**,不是新的 TaskStatus 档位 —— 刻意不改 `TaskStatus` 枚举:
   * 加档会波及全部既有消费端(web/desktop/RN 的 status 分支),而审批语义完全可以由
   * `approval.state` 表达(AGENTS.md §0.6 单一真相源:状态只有一个真相源,就是这张票)。
   *
   * 判读口径:`status === 'pending' && approval?.state === 'awaiting'` ⇒ 在等人拍板;
   * `approval.state === 'approved'` 之后才允许执行端真正开跑。
   */
  approval?: DelegationApprovalTicket
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
  /** 可选附件(2026-07-24 立,P2-c 跨端文件传输) */
  filePayload?: TaskFilePayload
  /**
   * 发起设备(2026-10-26 立)。**应当传真实 deviceId** —— 审批卡要送回这台。
   * 不传则回落 `'api'`,此时该委派无法进入审批路径(无人可答)。
   */
  fromDevice?: string
  /**
   * 是否要求审批(2026-10-26 立)。true ⇒ 先建审批票、票未 approved 前执行端不得开跑。
   * 缺省 false,保持既有"下发即执行"的行为不变(不动存量客户端语义)。
   */
  requireApproval?: boolean
  /** 审批票 TTL(毫秒),缺省由服务端定;超时一律落 expired,绝不静默放行 */
  approvalTtlMs?: number
}

/** POST /tasks/:id/approval —— 回答一张审批票(先答者胜,2026-10-26 立) */
export interface TaskApprovalRequest {
  /** true = 放行,false = 拒绝 */
  decision: boolean
  /** 票面版本;与服务端当前 seq 不等则判 stale/gap */
  seq: number
  /** 回答者设备;非 origin/target 判 rejected */
  deviceId: string
}

/** POST /tasks/:id/approval 响应:回传裁定结果与票的最新面 */
export interface TaskApprovalResponse {
  task: TaskDispatch
  /** applied = 本次回答生效;duplicate/stale/gap/rejected = 未生效(见判据文件裁定表) */
  verdict: string
  /** 未生效的点名原因 */
  reason: string
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
  // 'task-approval'(2026-10-26 立):审批票创建/迁移/停止时推,两端同示,先答者胜。
  type: 'task-dispatch' | 'task-result' | 'task-progress' | 'task-cancelled' | 'task-approval'
  taskId: string
  /** 取消/回答操作发起方设备标识(仅 task-cancelled / task-approval 消息携带) */
  deviceId?: string
  payload: TaskDispatch | TaskResult
}

/**
 * 任务取消请求(2026-07-23 立,P0 断网恢复 + 任务取消)。
 * POST /tasks/:id/cancel,body 可空或 { reason?: string }。
 */
export interface TaskCancelRequest {
  reason?: string
}

/** POST /tasks/:id/cancel 响应 */
export interface TaskCancelResponse {
  task: TaskDispatch
}

/**
 * 任务增量拉取查询参数(2026-07-23 立,P0 断网恢复)。
 * GET /tasks?since=<timestamp>,返回 updatedAt > since 的任务。
 * 不传 since 时返回全量。
 * 用途:WS 重连后补拉断线期间错过的任务。
 */
export interface TaskIncrementalQuery {
  since?: number
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
