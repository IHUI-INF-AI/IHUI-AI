// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D103 流内多智能体批量动作卡 · 共享层动作矩阵(G-141,2026-09-23 立)
//
// 对标 Codex `localConversation.multiAgentAction.*` 的一手形状:**「动作 × 三态」矩阵** ——
// 六个动作 `spawn / resume / sendInput / interrupt / close / list`,每个动作各
// `inProgress / completed / failed` 三态(如 创建中 / 已创建 / 创建失败)。
//
// **不另建第二套状态枚举**(台账 D103 明文):
//   · 「动作相位」(`AgentActionPhase`)与「实例状态」(`AgentInstanceState`,定义在 `@ihui/types`
//     的 agent-runtime 并带 `sessionStatusFromInstance` 下映射)是**两个正交维度**:
//     相位描述"这一次操作的进展",实例状态描述"这个智能体当前处于什么状态";
//   · 两者各自**只有一个**定义处,本模块只提供取键与矩阵,不复制枚举。
//
// 我方现状取证(2026-09-23):运行时只产出 `subagentStart` / `subagentStop` 两个事件,
// 七态词汇表为**新增能力**;在事件补齐之前,消费方不得假装已有细粒度状态。

import type { AgentInstanceState } from '@ihui/types'

/** 六个动作(取值即 i18n 键片段) */
export const AGENT_ACTIONS = ['spawn', 'resume', 'sendInput', 'interrupt', 'close', 'list'] as const
export type AgentAction = (typeof AGENT_ACTIONS)[number]

/** 单个动作的三个相位 */
export const AGENT_ACTION_PHASES = ['inProgress', 'completed', 'failed'] as const
export type AgentActionPhase = (typeof AGENT_ACTION_PHASES)[number]

/** 矩阵行(每个动作各三相位;`list` 同形,不搞特例 —— 特例会让"逐格有用例"失去意义) */
export interface AgentActionMatrixRow {
  readonly action: AgentAction
  readonly phases: readonly AgentActionPhase[]
}

export const AGENT_ACTION_MATRIX: readonly AgentActionMatrixRow[] = AGENT_ACTIONS.map((action) => ({
  action,
  phases: AGENT_ACTION_PHASES,
}))

const ACTION_SET: ReadonlySet<string> = new Set<string>(AGENT_ACTIONS)
const PHASE_SET: ReadonlySet<string> = new Set<string>(AGENT_ACTION_PHASES)

export function isAgentAction(value: string): value is AgentAction {
  return ACTION_SET.has(value)
}

export function isAgentActionPhase(value: string): value is AgentActionPhase {
  return PHASE_SET.has(value)
}

/** 动作名键(`ai.pane.agentActions.action.spawn.label`;把 label 收进动作子对象,避免与相位键撞名) */
export function agentActionLabelKey(action: AgentAction): string {
  return `action.${action}.label`
}

/** 动作相位键(`ai.pane.agentActions.action.spawn.inProgress`) */
export function agentActionPhaseKey(action: AgentAction, phase: AgentActionPhase): string {
  return `action.${action}.${phase}`
}

/** 实例状态键(`ai.pane.agentActions.state.notFound`) */
export function agentInstanceStateKey(state: AgentInstanceState): string {
  return `state.${state}`
}

/** 标题里的 count 走 **ICU plural**(H28 已验证链路;一种语义一个键,避免 5 语言词表爆炸) */
export const AGENT_ACTION_COUNT_KEY = 'header.count'
/** 行级模板:动作 + 智能体名 + 状态后缀 */
export const AGENT_ACTION_ROW_KEY = 'row.agent'
/** 元信息行:入参提示文本 */
export const AGENT_ACTION_PROMPT_KEY = 'meta.prompt'

/**
 * 按状态后缀拼接行级文案的**键后缀**。
 * 返回空串表示"该相位不需要后缀"(completed 已由动作键自带完成态语义时)。
 */
export function agentActionStateSuffix(action: AgentAction, phase: AgentActionPhase): string {
  void action
  return phase === 'failed' ? '.failed' : ''
}

/** 动作 × 相位的完整矩阵键列表(供守门/测试逐格断言覆盖率) */
export function agentActionMatrixKeys(): readonly string[] {
  return AGENT_ACTION_MATRIX.flatMap((row) => row.phases.map((phase) => agentActionPhaseKey(row.action, phase)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
