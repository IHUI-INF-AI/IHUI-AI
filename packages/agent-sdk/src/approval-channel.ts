// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-7 (L03/P1) 审批反向通道：协议 + 三队列 + session 追溯 + 断线不丢/重连按序补发。
 *
 * 判定边界（诚实纪律）：
 *   本模块实现**与传输无关的通道语义**——审批请求的形状、三队列的状态机、断线/重连
 *   的不丢与顺序保证。命名管道的 ACL 限当前用户由 apps/desktop/src-tauri/src/
 *   ipc_channel_acl.rs（B2-02，DACL 钉死当前用户+SYSTEM）承担，本模块只记录信任边界，
 *   不重造 ACL；真正的管道连接/断线事件由宿主注入 onDisconnect/onReconnect。
 *   本模块**不**宣称"真实命名管道已连通"——那需要 Windows 实机，属运行时验收缺口。
 *
 * 三队列：
 *   - pending  : 已受理、等待用户审批的请求（按 seq 单调）
 *   - backup   : 通道断开时 pending 整体转入的备份队列（不丢、保序）
 *   - recovery : 重连后从 backup 按序补发的请求，等待对端确认后出队
 *
 * 不变量：
 *   1. sessionId 非空且写入每条请求 → 可追溯到 session
 *   2. seq 升序补发：允许乱序到达（断线重连/多生产者场景），出队按 seq 升序而非到达顺序
 *   3. 同一 id 重复提交幂等（不产生第二条、不推进水位）
 *   4. 断线把 pending 全量转 backup；pending 清空但 backup 保序
 *   5. 重连把 backup 全量按序转 recovery；backup 清空但 recovery 保序
 *   6. 非法字段（空 sessionId / 空 id / 非有限 seq / 未知队列）fail-closed 抛错
 */

/** 审批请求：一次工具审批的最小可追溯事实（不含入参原值，与审计口径一致）。 */
export interface ApprovalRequest {
  /** 幂等键：同一审批请求重连补发时 id 不变。 */
  id: string
  /** 发起会话：请求可追溯到 session 的唯一依据。 */
  sessionId: string
  /** 单调递增序号：补发排序依据，不由到达顺序决定。 */
  seq: number
  /** 工具名（只记类型，不记入参原文）。 */
  toolName: string
  /** 决策种类：与 PermissionDecision 的 builtin/mcp/terminal 对齐。 */
  kind: 'builtin' | 'mcp' | 'terminal'
  /** 创建时刻（ms epoch），仅用于审计展示，不参与排序。 */
  createdAt: number
}

/** 队列名：三队列 + 终态（已确认），穷举以便 fail-closed 校验。 */
export const APPROVAL_QUEUES = ['pending', 'backup', 'recovery'] as const
export type ApprovalQueue = (typeof APPROVAL_QUEUES)[number]

/** 通道信任边界声明：真实 ACL 由 Rust 侧 ipc_channel_acl.rs 执行，这里只记录契约。 */
export interface ChannelTrust {
  /** 传输标识，如 '\\.\pipe\ihui-approval'。 */
  transport: string
  /** DACL 主体：必须恰为当前用户 + SYSTEM，不得含 Everyone/Authenticated Users。 */
  allowedPrincipals: readonly string[]
}

export class ApprovalChannelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApprovalChannelError'
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** fail-closed 校验：非法请求不进任何队列。 */
export function assertApprovalRequest(request: ApprovalRequest): void {
  if (!request || typeof request !== 'object') throw new ApprovalChannelError('审批请求必须是对象')
  if (!isNonEmptyString(request.id)) throw new ApprovalChannelError('审批请求 id 不得为空')
  if (!isNonEmptyString(request.sessionId))
    throw new ApprovalChannelError('审批请求 sessionId 不得为空')
  if (!Number.isSafeInteger(request.seq) || request.seq < 0)
    throw new ApprovalChannelError('审批请求 seq 必须为非负安全整数')
  if (!isNonEmptyString(request.toolName))
    throw new ApprovalChannelError('审批请求 toolName 不得为空')
  if (request.kind !== 'builtin' && request.kind !== 'mcp' && request.kind !== 'terminal') {
    throw new ApprovalChannelError(`审批请求 kind 非法: ${String(request.kind)}`)
  }
  if (!Number.isFinite(request.createdAt))
    throw new ApprovalChannelError('审批请求 createdAt 必须为有限数')
}

/** 按 seq 升序、id 升序排序（稳定补发顺序，不依赖数组到达顺序）。 */
function bySeqThenId(a: ApprovalRequest, b: ApprovalRequest): number {
  return a.seq - b.seq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/** 快照：返回副本，避免外部直接改队列破坏不变量。 */
function snapshot(items: ApprovalRequest[]): ApprovalRequest[] {
  return items.map((item) => ({ ...item }))
}

/**
 * 审批反向通道：三队列状态机。宿主负责把 onDisconnect/onReconnect 与真实传输对接。
 */
export class ApprovalChannel {
  private readonly pending: ApprovalRequest[] = []
  private readonly backup: ApprovalRequest[] = []
  private readonly recovery: ApprovalRequest[] = []
  private readonly seen = new Set<string>()
  private lastSeq = -1
  private connected = true

  constructor(readonly trust: ChannelTrust) {
    if (!trust || !isNonEmptyString(trust.transport))
      throw new ApprovalChannelError('通道 transport 不得为空')
    if (!Array.isArray(trust.allowedPrincipals) || trust.allowedPrincipals.length === 0) {
      throw new ApprovalChannelError(
        '通道 allowedPrincipals 不得为空（须由 ACL 钉死当前用户+SYSTEM）',
      )
    }
  }

  /** 受理审批请求：非法 fail-closed；重复 id 幂等；乱序到达也收下（出队按 seq 排序）。 */
  accept(request: ApprovalRequest): void {
    assertApprovalRequest(request)
    if (this.seen.has(request.id)) return // 幂等：不产生第二条、不推进水位
    const copy = { ...request }
    if (this.connected) {
      this.pending.push(copy)
    } else {
      // 断线期间到达的请求直接进 backup，绝不丢
      this.backup.push(copy)
    }
    this.seen.add(request.id)
    this.lastSeq = Math.max(this.lastSeq, request.seq) // 水位取最大 seq，乱序到达不回退
  }

  /** 断线：pending 全量转 backup（保序、不丢），清空 pending。可重复调用（幂等）。 */
  disconnect(): void {
    if (!this.connected) return
    this.connected = false
    this.backup.push(...this.pending.splice(0, this.pending.length))
    this.backup.sort(bySeqThenId)
  }

  /** 重连：backup 全量按序转 recovery（保序、不丢），清空 backup。未断线时调用幂等。 */
  reconnect(): void {
    if (this.connected) return
    this.connected = true
    this.recovery.push(...this.backup.splice(0, this.backup.length))
    this.recovery.sort(bySeqThenId)
  }

  /**
   * 对端确认 recovery 请求：从 recovery 移除。按 id 确认，防止按索引确认时序列漂移。
   * @returns 是否确实移除了一个（重复确认返回 false）
   */
  acknowledge(id: string): boolean {
    if (!isNonEmptyString(id)) throw new ApprovalChannelError('确认 id 不得为空')
    const idx = this.recovery.findIndex((item) => item.id === id)
    if (idx < 0) return false
    this.recovery.splice(idx, 1)
    return true
  }

  /** 读取指定队列快照（默认按 seq 升序），不暴露内部数组。 */
  queue(name: ApprovalQueue): ApprovalRequest[] {
    if (!APPROVAL_QUEUES.includes(name)) throw new ApprovalChannelError(`未知队列: ${String(name)}`)
    const src = name === 'pending' ? this.pending : name === 'backup' ? this.backup : this.recovery
    return snapshot([...src].sort(bySeqThenId))
  }

  /** 连接态。 */
  isConnected(): boolean {
    return this.connected
  }

  /** 序列水位（最后受理的 seq），用于诊断补发是否完整。 */
  watermark(): number {
    return this.lastSeq
  }
}
