// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D97 云端聊天互操作活动卡(G-133,2026-09-24 立) · 共享层判定矩阵。
//
// 五动作 `附加云端聊天 / 创建云端聊天 / 列出云端聊天 / 读取云端聊天轮次 / 向云端聊天发送消息`,
// 每动作各 `active / completed / following` 三态 = **15 格**(台账 G-133:「活动条措辞四维矩阵
// active/completed/following × 带标题」中"跨端操作"一维的落格)。
//
// **与 D50 多端遥控合并设计,不另建第二套传输**(台账 D97 明文):
//   · 本模块是**单一真相源**里「展示判定」的一维:只产出「动作 × 三态」的取键与聚合,
//     **不产出任何传输调用**;
//   · 跨端操作的投递/中止一律复用既有通道 —— 投递走 `/api/task-messages`
//     (apps/api/src/routes/task-messages.ts,D25/D28 多端任务消息),中止走 W2 abort 通道;
//   · 对接形状:`CloudChatOpEntry` 是 D50 多端遥控投递层 → 活动卡的**唯一**载荷类型。
//     传输侧(HTTP / WS / 桌面桥)把观察到的跨端操作映射成 entry 后经 props 注入
//     CloudChatOpsCard,本层与组件都不关心传输介质。

/** 五个云端聊天互操作动作(取值即 i18n 键片段) */
export const CLOUD_CHAT_OPS = [
  'attachCloudChat',
  'createCloudChat',
  'listCloudChats',
  'readCloudChatTurns',
  'sendToCloudChat',
] as const
export type CloudChatOp = (typeof CLOUD_CHAT_OPS)[number]

/** 单个动作的三态(active/completed/following;following = 等待上游动作) */
export const CLOUD_CHAT_OP_PHASES = ['active', 'completed', 'following'] as const
export type CloudChatOpPhase = (typeof CLOUD_CHAT_OP_PHASES)[number]

/** 活动条一行:某个云端聊天操作在某个时点的三态落格 */
export interface CloudChatOpEntry {
  readonly op: CloudChatOp
  readonly phase: CloudChatOpPhase
  /** 目标云端会话名/ID(展示用;缺省不渲染目标段) */
  readonly target?: string
}

const OP_SET: ReadonlySet<string> = new Set<string>(CLOUD_CHAT_OPS)
const PHASE_SET: ReadonlySet<string> = new Set<string>(CLOUD_CHAT_OP_PHASES)

export function isCloudChatOp(value: string): value is CloudChatOp {
  return OP_SET.has(value)
}

export function isCloudChatOpPhase(value: string): value is CloudChatOpPhase {
  return PHASE_SET.has(value)
}

export interface CloudChatOpCellKeys {
  /** 格标签键(`ai.pane.cloudChatOps` 之下) */
  readonly labelKey: string
  /** 格 aria 键:词包按规格只有卡级 ariaLabel,格内 aria 复用格标签,不另增 15 键 */
  readonly ariaKey: string
}

const cellKeys = (op: CloudChatOp, phase: CloudChatOpPhase): CloudChatOpCellKeys => ({
  labelKey: `op.${op}.${phase}`,
  ariaKey: `op.${op}.${phase}`,
})

/**
 * 动作 × 三态 → 15 格键名。**映射表穷尽**:`Record<CloudChatOp, Record<CloudChatOpPhase, …>>`
 * 缺任何一格直接编译失败(对标 agent-actions.ts 的 agentActionPhaseKey/agentActionMatrixKeys)。
 */
const CELL_KEYS: Readonly<
  Record<CloudChatOp, Record<CloudChatOpPhase, CloudChatOpCellKeys>>
> = {
  attachCloudChat: {
    active: cellKeys('attachCloudChat', 'active'),
    completed: cellKeys('attachCloudChat', 'completed'),
    following: cellKeys('attachCloudChat', 'following'),
  },
  createCloudChat: {
    active: cellKeys('createCloudChat', 'active'),
    completed: cellKeys('createCloudChat', 'completed'),
    following: cellKeys('createCloudChat', 'following'),
  },
  listCloudChats: {
    active: cellKeys('listCloudChats', 'active'),
    completed: cellKeys('listCloudChats', 'completed'),
    following: cellKeys('listCloudChats', 'following'),
  },
  readCloudChatTurns: {
    active: cellKeys('readCloudChatTurns', 'active'),
    completed: cellKeys('readCloudChatTurns', 'completed'),
    following: cellKeys('readCloudChatTurns', 'following'),
  },
  sendToCloudChat: {
    active: cellKeys('sendToCloudChat', 'active'),
    completed: cellKeys('sendToCloudChat', 'completed'),
    following: cellKeys('sendToCloudChat', 'following'),
  },
}

export function cloudChatOpKeys(op: CloudChatOp, phase: CloudChatOpPhase): CloudChatOpCellKeys {
  return CELL_KEYS[op][phase]
}

/** 动作名键(`op.attachCloudChat.label`,zh-CN 逐字取任务原文「附加云端聊天」等) */
export function cloudChatOpLabelKey(op: CloudChatOp): string {
  return `op.${op}.label`
}

/** 矩阵键列表(15 格,供守门/测试逐格断言覆盖率) */
export function cloudChatOpMatrixKeys(): readonly string[] {
  return CLOUD_CHAT_OPS.flatMap((op) => CLOUD_CHAT_OP_PHASES.map((phase) => cloudChatOpKeys(op, phase).labelKey))
}

/** 卡片标题键 / 卡级 ariaLabel 键 / 空态键 */
export const CLOUD_CHAT_OPS_TITLE_KEY = 'title'
export const CLOUD_CHAT_OPS_ARIA_KEY = 'ariaLabel'
export const CLOUD_CHAT_OPS_EMPTY_KEY = 'empty'
/** following 态提示位键(「等待上游动作」) */
export const CLOUD_CHAT_OPS_WAITING_KEY = 'waitingUpstream'

/** 聚合判定结果:rows 为通过类型守卫的有效行 */
export interface CloudChatOpsView {
  readonly rows: readonly CloudChatOpEntry[]
  /** following 态行数;>0 时活动条渲染「等待上游动作」提示位 */
  readonly waitingOpCount: number
}

/**
 * 活动条聚合判定:
 *   · ops 为空 → null(不渲染空卡);
 *   · 含 following 态 → waitingOpCount > 0,消费方给出「等待上游动作」提示位。
 * 本函数只做判定,不取数、不传输。
 */
export function cloudChatOpsView(ops: readonly CloudChatOpEntry[]): CloudChatOpsView | null {
  if (ops.length === 0) return null
  const rows = ops.filter((entry) => isCloudChatOp(entry.op) && isCloudChatOpPhase(entry.phase))
  const waitingOpCount = rows.filter((entry) => entry.phase === 'following').length
  return { rows, waitingOpCount }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
