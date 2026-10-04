// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D133(2026-09-30 立,承 V4 #91):SSE 事件族登记表 —— 两套命名族的唯一索引源。
//
// 仓库里并存两套 SSE 事件命名族:对话流(contract.ts 的 SSE_EVENTS,32 名,kebab/snake
// 混排)与 agent 任务流(agent-events.ts 的 AGENT_TASK_EVENTS,15 名)。两族此前没有
// 任何交叉索引,同义事件在不同流上各叫各的名(tool-result 对 tool_result、
// terminal_delta 对 terminal-delta),谁也说不清"这个名字在另一条流上叫什么、还是
// 根本没有对应物"。本文件把这一格变成可指认的事实:
//
//  1. **族清单不手抄第二份**(防漂移的硬约束):对话流族与 agent 任务流族都从各自
//     单源常量 import 派生 —— contract.ts 与 agent-events.ts 仍是事件名的唯一事实源,
//     本文件只是它们的登记表与交叉索引;在这里再写一份名字清单就是"同一事实两份真相"。
//  2. **交叉映射表逐名穷尽**(tsc 强制):键侧类型是完整 SSEEventName 联合 ⇒ 对话流
//     新增一个事件而不登记它,`tsc --noEmit` 直接红;值侧类型是
//     `AgentTaskEventName | null` ⇒ 拼错另一族的名字或把"无交叉"写成事件名同样红。
//     "无交叉"如实标 null,不许编一个看起来像的对应物充数。
//  3. **启动期对账,不一致即 throw**(本票对 contract.ts / agent-events.ts 的零改动
//     选择):assertSseFamiliesConsistent 在本模块加载时执行,校验①两族清单与各自
//     单源逐名等值(挡住"绕开本文件另抄一份族清单"的回潮)②交叉表每个键都在对话流
//     族里、每个非 null 值都在 agent 任务流族里(挡住手写表漂移)。任何一条不满足
//     直接 throw,点名 offender —— 不给"看起来全绿"留门。
//
// 未知事件名"计数 + 点名(有界)"的出口不在这里:那份职责只有一份,在
// ./unknown-event-telemetry(G-816042;本票补有界点名清单),分发工厂的 default
// 分支是唯一调用方。两处算同一件事必漂移。

import { AGENT_TASK_EVENT_NAMES, AGENT_TASK_EVENTS } from './agent-events'
import type { AgentTaskEventName } from './agent-events'
import { SSE_EVENT_NAMES } from './contract'
import type { SSEEventName } from './contract'

/** 族登记条目:族 id + 事件名清单(从单源派生,此处不持有名字字面量)。 */
export interface SseEventFamily {
  /** 族 id(wire 上没有的东西,仅登记/对账用) */
  readonly id: 'chat-stream' | 'agent-task-stream'
  /** 名单来源(人可读,指向唯一事实源文件) */
  readonly source: string
  /** 事件名清单(直接取自单源的派生数组,防第二份) */
  readonly names: readonly string[]
}

/** 对话流族(/v1/chat/completions 流,名单源自 contract.ts SSE_EVENTS)。 */
export const SSE_EVENT_FAMILY_CHAT: SseEventFamily = {
  id: 'chat-stream',
  source: 'packages/shared/src/sse/contract.ts (SSE_EVENTS)',
  names: SSE_EVENT_NAMES,
}

/** agent 任务流族(/agents/tasks/stream,名单源自 agent-events.ts AGENT_TASK_EVENTS)。 */
export const SSE_EVENT_FAMILY_AGENT_TASK: SseEventFamily = {
  id: 'agent-task-stream',
  source: 'packages/shared/src/sse/agent-events.ts (AGENT_TASK_EVENTS)',
  names: AGENT_TASK_EVENT_NAMES,
}

/** 全部已登记族(顺序稳定,消费方按 id 取,不按下标)。 */
export const SSE_EVENT_FAMILIES: readonly SseEventFamily[] = [
  SSE_EVENT_FAMILY_CHAT,
  SSE_EVENT_FAMILY_AGENT_TASK,
]

/**
 * 交叉映射表:对话流事件名 → agent 任务流事件名(或 null = 该流无同义事件)。
 *
 * 登记判据(两条,缺一即 null):
 *  - **同名**:两族字面量逐字符相等(thinking / plan-step / compaction / error /
 *    tool-approval —— 注意 tool-approval 两族同用 kebab,是混排族里的少数派);
 *  - **同义**:wire 语义相同而编码不同 —— tool-call-start 对 tool_call(工具调用
 *    开始)、tool-result 对 tool_result(工具执行结果)、terminal_delta 对
 *    terminal-delta(终端逐行增量;snake 对 kebab,正是本表存在的理由)。
 *
 * 刻意**不**登记的近似项(如实标 null,防"看起来对应"的假话):
 *  - start ≠ session:对话流 start 是任务执行开始(带 resume_from),agent 流 session
 *    是会话建立,生命周期不同位;
 *  - plan_updated ≠ plan-step:前者是对话流整表更新帧,后者是 agent 流时间线增量,
 *    载荷与节奏都不同;
 *  - chunk / message:对话流文本增量是 chunk,agent 流 LLM 响应走 message(onmessage
 *    泛型通道),承载面不同构,不并。
 *
 * 键穷尽性由 mapped type 强制:对话流加名不登记 ⇒ tsc 红。
 */
export const SSE_FAMILY_CROSS_REFERENCES: {
  readonly [K in SSEEventName]: AgentTaskEventName | null
} = {
  chunk: null,
  reasoning: null,
  'tool-call-start': AGENT_TASK_EVENTS.TOOL_CALL,
  'tool-result': AGENT_TASK_EVENTS.TOOL_RESULT,
  'tool-delegate': null,
  'tool-summary': null,
  citations: null,
  question: null,
  subagent_spawn: null,
  subagent_progress: null,
  subagent_end: null,
  'plan-step': AGENT_TASK_EVENTS.PLAN_STEP,
  thinking: AGENT_TASK_EVENTS.THINKING,
  plan_updated: null,
  terminal_start: null,
  terminal_end: null,
  terminal_delta: AGENT_TASK_EVENTS.TERMINAL_DELTA,
  terminal_interaction: null,
  done: null,
  error: AGENT_TASK_EVENTS.ERROR,
  fallback: null,
  usage: null,
  compaction: AGENT_TASK_EVENTS.COMPACTION,
  steer: null,
  budget: null,
  injection_applied: null,
  retry_scheduled: null,
  start: null,
  'tool-approval': AGENT_TASK_EVENTS.TOOL_APPROVAL,
  'tool-delta': null,
  form_request: null,
  goal_updated: null,
}
// 2026-10-05:本表原先有 `partial_done: null` 一行(2026-10-04 G-815976 加的),
// 但 `SSE_EVENTS.PARTIAL_DONE` 已从 `contract.ts` 移除 ⇒ `SSEEventName` 联合里不再有它。
// 该表的类型是 `readonly [K in SSEEventName]`(**映射类型要求键齐全**),
// 多留这一行会在**模块求值期**抛 `[sse-families] cross-reference key "partial_done"
// is not in the chat-stream family` ⇒ 凡经 `@ihui/shared` barrel 的 import 即失败
// (实测 948 个文件连带无法验证)。消费方只有 `sse-families.test.ts`,无运行时行为依赖。
// 故按事实删掉这一行,而**不是**把 `PARTIAL_DONE` 常量恢复回来 ——
// 后者是已被上游有意移除的事件,恢复它等于推翻对方的收口。

/** 查对话流事件在 agent 任务流上的同义名;无交叉返回 null(不猜)。 */
export function chatToAgentTaskCrossReference(name: SSEEventName): AgentTaskEventName | null {
  return SSE_FAMILY_CROSS_REFERENCES[name]
}

/** 反向派生表(agent 任务流名 → 对话流名),由正向表在加载时算出,不手写第二份。 */
const AGENT_TASK_TO_CHAT: { readonly [K in AgentTaskEventName]?: SSEEventName } = (() => {
  const out: { [K in AgentTaskEventName]?: SSEEventName } = {}
  for (const entry of Object.entries(SSE_FAMILY_CROSS_REFERENCES)) {
    const [chatName, agentName] = entry as readonly [SSEEventName, AgentTaskEventName | null]
    if (agentName !== null) out[agentName] = chatName
  }
  return out
})()

/** 查 agent 任务流事件在对话流上的同义名;无交叉返回 undefined(不猜)。 */
export function agentTaskToChatCrossReference(name: AgentTaskEventName): SSEEventName | undefined {
  return AGENT_TASK_TO_CHAT[name]
}

/** 对账入参(默认取真实登记表;测试注入篡改表用,宿主不需要传)。 */
export interface SseFamiliesConsistencyTables {
  readonly chatNames?: readonly string[]
  readonly agentTaskNames?: readonly string[]
  readonly cross?: Readonly<Record<string, string | null>>
}

/**
 * 启动期对账(本模块加载时执行,亦可显式调用):
 *  ① 对话流族清单 === contract.ts SSE_EVENTS 的值集(逐名等值);
 *  ② agent 任务流族清单 === agent-events.ts AGENT_TASK_EVENTS 的值集;
 *  ③ 交叉表每个键都在对话流族里,每个非 null 值都在 agent 任务流族里。
 * 任一不满足即 throw,点名 offender —— 静默放过就是"看起来全绿"那一型。
 */
export function assertSseFamiliesConsistent(tables?: SseFamiliesConsistencyTables): void {
  const chatNames = tables?.chatNames ?? SSE_EVENT_NAMES
  const agentTaskNames = tables?.agentTaskNames ?? AGENT_TASK_EVENT_NAMES
  const cross = tables?.cross ?? SSE_FAMILY_CROSS_REFERENCES

  const chatSet = new Set<string>(chatNames)
  if (chatSet.size !== chatNames.length) {
    throw new Error(
      `[sse-families] chat-stream family has duplicate event names: ${[...chatSet].length}/${chatNames.length}`,
    )
  }
  const agentSet = new Set<string>(agentTaskNames)
  if (agentSet.size !== agentTaskNames.length) {
    throw new Error(
      `[sse-families] agent-task-stream family has duplicate event names: ${[...agentSet].length}/${agentTaskNames.length}`,
    )
  }

  for (const [chatName, agentName] of Object.entries(cross)) {
    if (!chatSet.has(chatName)) {
      throw new Error(
        `[sse-families] cross-reference key "${chatName}" is not in the chat-stream family (contract.ts SSE_EVENTS)`,
      )
    }
    if (agentName !== null && !agentSet.has(agentName)) {
      throw new Error(
        `[sse-families] cross-reference "${chatName}" -> "${agentName}" is not in the agent-task-stream family (agent-events.ts AGENT_TASK_EVENTS)`,
      )
    }
  }
}

// 启动期对账:本模块被 import(经 index.ts 进所有消费面)即执行,不一致立即 throw。
assertSseFamiliesConsistent()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
