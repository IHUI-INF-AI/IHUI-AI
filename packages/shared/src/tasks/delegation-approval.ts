// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨设备委派审批判据(2026-10-26 立,承 nanoMuse 对比调研的 P0-1)。
 *
 * 立此文件的起因:与 nanoMuse 逐项对比后判「我们同步的是聊天历史,它同步的是执行权」。
 * 但**现读代码面证明这条判重了**:`apps/api/src/routes/tasks.ts` 自 2026-07-23 起就有
 * 完整的执行权通道 —— `POST /tasks/dispatch` 按 `toDevice` 定向、`POST /tasks/result` 回推、
 * `POST /tasks/:id/cancel` 即 Stop、设备注册表带 30s 心跳 + 60s TTL。
 * 缺的不是"委派原语",是**派出去的活儿没人审、审批不跟人**。
 *
 * 因此本文件只补一层纯判据,不新造调度通道:
 *   ① **审批跟人** —— 委派发起时记录 `originDeviceId`(提问的那台)与 `targetDeviceId`
 *      (干活的那台),审批卡**两端同示**,先答者胜;
 *   ② **先答者胜** —— 同一 `seq` 下第一个落地的回答之外的全部回答判 duplicate,
 *      不做"后答覆盖先答"(否则两台设备各点一次就是执行两次);
 *   ③ **Stop 覆盖一切未终态** —— 人可在任意一端按 Stop,包括票还挂在 awaiting 时;
 *   ④ **非授权设备无权答** —— 只有 origin / target 两台能答,同一用户的第三台设备判 rejected
 *      (它能**看**委派,但不能替人拍板)。
 *
 * 刻意不做的三件事(留生产端接线票,不在本判据内):
 *   - 不接网络/WS/Redis:本文件全纯函数,输入输出都是值;
 *   - 不管"委派内容本身"(command 还是 agent run),那是 `TaskDispatch` 的扩展面;
 *   - 不做超时自动放行 —— 过期一律落 `expired`(终止态),绝不静默转 approved。
 *
 * 与既有资产的关系:状态机**复用** `TaskStatus` 的五档语义,本文件只在其上叠审批维,
 * 不另立一套 status(AGENTS.md §0.6 单一真相源)。
 */

import type { TaskStatus } from './dispatch.js'

/** 审批票状态。终止态 = 除 `awaiting` 外的全部(先答者胜只在 awaiting 上生效一次)。 */
export type DelegationApprovalState = 'awaiting' | 'approved' | 'denied' | 'stopped' | 'expired'

/** 未终态:只有它可以被回答/停止 */
export const DELEGATION_OPEN_STATE: DelegationApprovalState = 'awaiting'

/** 全部终止态(顺序即语义分组:人答了 / 人停了 / 超时了) */
export const DELEGATION_CLOSED_STATES: readonly DelegationApprovalState[] = [
  'approved',
  'denied',
  'stopped',
  'expired',
]

/** 回答者相对本票的角色 */
export type DelegationActorRole = 'origin' | 'target' | 'foreign'

/**
 * 委派审批票。
 *
 * `seq` 是票面版本号(创建时为 0,每次合法状态迁移 +1):它同时是**幂等键的一半** ——
 * 网络重投的同一票必须携带同一个 seq,否则判 stale/gap(与 chat-sync-contract 的
 * `(messageId, rev)` 同纪律,不另发明一套)。
 */
export interface DelegationApprovalTicket {
  /** 委派 ID,与 `TaskDispatch.id` 同源 */
  delegationId: string
  /** 提问的那台设备(审批卡必达) */
  originDeviceId: string
  /** 干活的那台设备(审批卡同示) */
  targetDeviceId: string
  /** 票面版本,创建为 0 */
  seq: number
  state: DelegationApprovalState
  /** 先答者设备(仅已答票有值) */
  answeredBy?: string
  /** 先答时刻(ISO) */
  answeredAt?: string
  /** 委派落地后的执行状态;审批未过时恒为 'pending' */
  taskStatus?: TaskStatus
  /**
   * 票创建时刻(epoch ms)。与 `ttlMs` 配套,让过期判定**自包含** ——
   * 生产端不必另传 createdAt(另传就会与票面漂移,是 AGENTS §0.6 明令的第二真相源)。
   */
  createdAtMs?: number
  /** 票存活上限(ms);缺省由生产端定兜底值。超时一律落 expired,绝不静默放行 */
  ttlMs?: number
}

/** 生产端未显式给 TTL 时的兜底:5 分钟(足够人看到卡,又不至于让委派无限挂着) */
export const DELEGATION_DEFAULT_TTL_MS = 300_000

export interface DelegationApprovalAnswer {
  deviceId: string
  /** true = 放行,false = 拒绝 */
  decision: boolean
  seq: number
  at?: string
}

export type DelegationVerdict =
  /** 生效:票已迁移到终止态 */
  | 'applied'
  /** 重投:票已 closed(先答者胜),或同 seq 重复到达 */
  | 'duplicate'
  /** 迟到:带的是更早的 seq */
  | 'stale'
  /** 断链:带的是更晚的 seq,本方还没走到那一步 */
  | 'gap'
  /** 越权:既不是 origin 也不是 target */
  | 'rejected'
  /** 票不存在 */
  | 'missing'

export interface DelegationResolution {
  verdict: DelegationVerdict
  /** 裁定后的票(未生效时返回**原引用**,与 chat-sync 内核同纪律:拒绝不触发状态发布) */
  ticket: DelegationApprovalTicket
  /** 未生效的点名原因(生效时为空串) */
  reason: string
}

/** 幂等键(与 chat-sync 的 `(messageId, rev)` 同形,便于两侧对账) */
export function delegationApprovalKey(delegationId: string, seq: number): string {
  return `${delegationId}@${seq}`
}

/** 回答者角色:origin / target 之外一律 foreign(同一用户的第三台设备也算 foreign) */
export function delegationActorRoleOf(
  ticket: DelegationApprovalTicket,
  deviceId: string,
): DelegationActorRole {
  if (deviceId === ticket.originDeviceId) return 'origin'
  if (deviceId === ticket.targetDeviceId) return 'target'
  return 'foreign'
}

/**
 * **审批跟人**:这张卡该推给谁。
 *
 * 恒为 [origin, target](origin === target 时去重为一份)—— 这正是 nanoMuse 那条
 * "审批卡片送回提问的那台设备,目标本机同示一张卡" 的可机读形式。
 * 同一用户的**其他**设备可以看到委派在跑(走既有 task-dispatch 广播),但不进这个集合,
 * 因此拿不到答票权(见 `resolveDelegationAnswer` 的 rejected)。
 */
export function delegationApprovalAudienceOf(ticket: DelegationApprovalTicket): string[] {
  return ticket.originDeviceId === ticket.targetDeviceId
    ? [ticket.originDeviceId]
    : [ticket.originDeviceId, ticket.targetDeviceId]
}

/** 新建一张待审批票(taskStatus 缺省 'pending',与 TaskDispatch 初态一致) */
export function openDelegationApproval(input: {
  delegationId: string
  originDeviceId: string
  targetDeviceId: string
  taskStatus?: TaskStatus
  ttlMs?: number
  /** 注入时钟(测试用);不传取 Date.now() */
  nowMs?: number
}): DelegationApprovalTicket {
  return {
    delegationId: input.delegationId,
    originDeviceId: input.originDeviceId,
    targetDeviceId: input.targetDeviceId,
    seq: 0,
    state: DELEGATION_OPEN_STATE,
    taskStatus: input.taskStatus ?? 'pending',
    createdAtMs: input.nowMs ?? Date.now(),
    ttlMs: input.ttlMs ?? DELEGATION_DEFAULT_TTL_MS,
  }
}

/**
 * 过期判定的**唯一入口**:读票自带的 `createdAtMs` / `ttlMs`,生产端不再另传时间参数。
 * 票缺这两个字段(老票/手写票)⇒ 未判定(返回 null),**不猜、不默认放行**。
 */
export function resolveTicketExpiry(
  ticket: DelegationApprovalTicket | null | undefined,
  nowMs: number,
): DelegationResolution | null {
  if (!ticket) return null
  if (typeof ticket.createdAtMs !== 'number' || typeof ticket.ttlMs !== 'number') return null
  return resolveDelegationExpiry(ticket, {
    nowMs,
    createdAtMs: ticket.createdAtMs,
    ttlMs: ticket.ttlMs,
  })
}

/** 统一的"未生效"出口:原引用返回,不克隆(拒绝不得产生新对象,免得消费端误判改过状态) */
function refuse(
  ticket: DelegationApprovalTicket,
  verdict: DelegationVerdict,
  reason: string,
): DelegationResolution {
  return { verdict, ticket, reason }
}

/**
 * 核心裁定:回答一张审批票(先答者胜)。
 *
 * 裁定表(与下方测试逐行对应):
 * | 输入 | 裁定 | 理由 |
 * | --- | --- | --- |
 * | 票不存在 | missing | 无票可答 |
 * | seq > ticket.seq | gap | 本方票面落后,先补再答 |
 * | seq < ticket.seq | stale | 迟到重投,一律丢弃 |
 * | 票非 awaiting | duplicate | **先答者胜**,后来者不得翻案 |
 * | 回答者 foreign | rejected | 只有提问方与干活方能拍板 |
 * | 其余 | applied | 迁移到 approved/denied,seq+1 |
 */
export function resolveDelegationAnswer(
  ticket: DelegationApprovalTicket | null | undefined,
  answer: DelegationApprovalAnswer,
): DelegationResolution {
  if (!ticket) {
    return refuse(
      ticket as unknown as DelegationApprovalTicket,
      'missing',
      `委派票不存在(delegationId 未登记)`,
    )
  }
  if (answer.seq > ticket.seq) {
    return refuse(ticket, 'gap', `票面落后:本方 seq=${ticket.seq} < 到达 seq=${answer.seq}`)
  }
  if (answer.seq < ticket.seq) {
    return refuse(ticket, 'stale', `迟到重投:本方 seq=${ticket.seq} > 到达 seq=${answer.seq}`)
  }
  if (ticket.state !== DELEGATION_OPEN_STATE) {
    return refuse(
      ticket,
      'duplicate',
      `先答者胜:票已 ${ticket.state}(先答设备=${ticket.answeredBy ?? '未知'})`,
    )
  }
  if (delegationActorRoleOf(ticket, answer.deviceId) === 'foreign') {
    return refuse(
      ticket,
      'rejected',
      `越权:设备 ${answer.deviceId} 既非提问方(${ticket.originDeviceId})亦非执行方(${ticket.targetDeviceId})`,
    )
  }
  return {
    verdict: 'applied',
    ticket: {
      ...ticket,
      seq: ticket.seq + 1,
      state: answer.decision ? 'approved' : 'denied',
      answeredBy: answer.deviceId,
      answeredAt: answer.at,
      // 拒绝即终止,委派不落地;放行后执行态交给生产端推进(本判据不代跑)
      taskStatus: answer.decision ? (ticket.taskStatus ?? 'pending') : 'cancelled',
    },
    reason: '',
  }
}

/**
 * Stop:人在任意一端按下即终止,**包括票还挂在 awaiting 的时候**。
 *
 * 与回答同一把 seq 尺(stop 也推进 seq),因此"先答者胜"对 stop 同样成立:
 * 已经 closed 的票再收 stop ⇒ duplicate,不翻案。
 */
export function resolveDelegationStop(
  ticket: DelegationApprovalTicket | null | undefined,
  input: { deviceId: string; seq: number },
): DelegationResolution {
  if (!ticket) {
    return refuse(ticket as unknown as DelegationApprovalTicket, 'missing', `委派票不存在`)
  }
  if (input.seq > ticket.seq) {
    return refuse(ticket, 'gap', `票面落后:本方 seq=${ticket.seq} < 到达 seq=${input.seq}`)
  }
  if (input.seq < ticket.seq) {
    return refuse(ticket, 'stale', `迟到重投:本方 seq=${ticket.seq} > 到达 seq=${input.seq}`)
  }
  if (ticket.state !== DELEGATION_OPEN_STATE) {
    return refuse(ticket, 'duplicate', `票已 ${ticket.state},stop 不翻案`)
  }
  if (delegationActorRoleOf(ticket, input.deviceId) === 'foreign') {
    return refuse(ticket, 'rejected', `越权:设备 ${input.deviceId} 无权 stop 本委派`)
  }
  return {
    verdict: 'applied',
    ticket: {
      ...ticket,
      seq: ticket.seq + 1,
      state: 'stopped',
      answeredBy: input.deviceId,
      taskStatus: 'cancelled',
    },
    reason: '',
  }
}

/**
 * 超时:一律落 `expired`(终止态),**绝不静默转 approved**。
 * 委派是要在别人机器上跑的活儿,没人拍板就等于不放行 —— 这一格不能做"默认同意"。
 */
export function resolveDelegationExpiry(
  ticket: DelegationApprovalTicket | null | undefined,
  input: { nowMs: number; createdAtMs: number; ttlMs: number },
): DelegationResolution {
  if (!ticket) {
    return refuse(ticket as unknown as DelegationApprovalTicket, 'missing', `委派票不存在`)
  }
  if (ticket.state !== DELEGATION_OPEN_STATE) {
    return refuse(ticket, 'duplicate', `票已 ${ticket.state},过期判定不翻案`)
  }
  const age = input.nowMs - input.createdAtMs
  if (age < input.ttlMs) {
    return refuse(ticket, 'duplicate', `未过期:已存活 ${age}ms < ttl ${input.ttlMs}ms`)
  }
  return {
    verdict: 'applied',
    ticket: { ...ticket, seq: ticket.seq + 1, state: 'expired', taskStatus: 'cancelled' },
    reason: '',
  }
}
