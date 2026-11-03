// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D38 队列语义完整交互 — cli(终端)端判定适配器(G-42 / H18 跨端消费矩阵)
//
// 本文件是 apps/cli 对真相源 `@ihui/shared/chat/queue-interactions`(+ D69
// `input-notices` 许可判定)的**唯一**消费出口:repl.ts 的 /queue 子命令与运行中
// 输入路由全部经这里取判据,端内不得再手写第二套许可/模式/打断判定(§3 共享层优先)。
//
// cli 端事实(判据输入的依据,均可复测):
//   · Runtime 插话能力恒真 — 本端工具循环原生支持 mid-turn 注入
//     (apps/cli/src/interjection.ts + repl.ts:776-778 运行中输入进 InterjectionBuffer),
//     故 queueInteractionPerms 的 runtimeSupportsInterjection 传 true,不另立协商。
//   · 「流式中」即 state.agentRunning(repl.ts:261)。
//   · follow-up 模式是用户偏好:steer = 运行中输入进插话缓冲(现状默认);
//     queue = 运行中输入排队(经 interruptPlan/effectiveMode 同一真相源派发)。

import {
  effectiveMode,
  interactionAllowed,
  interruptPlan,
  isFollowUpMode,
  type FollowUpModeResolution,
  type InteractionVerdict,
  type QueueInteractionKind,
} from '@ihui/shared/chat/queue-interactions'
import { queueInteractionPerms, type QueueInteractionPerms } from '@ihui/shared/chat/input-notices'

/** cli 端可从 repl 状态取到的最小队列事实(纯数据,便于测试注入) */
export interface CliQueueFacts {
  readonly hasQueuedMessages: boolean
  readonly streaming: boolean
}

/** 许可判定唯一入口:D69 queueInteractionPerms + cli 恒支持的插话能力 */
export function cliQueuePerms(facts: CliQueueFacts): QueueInteractionPerms {
  return queueInteractionPerms({
    hasQueuedMessages: facts.hasQueuedMessages,
    streaming: facts.streaming,
    runtimeSupportsInterjection: true,
  })
}

/** 动词 → 许可结论(与 web queue-interaction-bar 同一判定,零端内分支) */
export function cliQueueInteractionAllowed(
  kind: QueueInteractionKind,
  facts: CliQueueFacts,
): InteractionVerdict {
  return interactionAllowed(kind, cliQueuePerms(facts))
}

export interface CliInterruptRunPlan {
  readonly allowed: boolean
  /** 被拒时的 D69 deniedNotice 键(`denied.<action>`);allowed 时恒 null */
  readonly deniedKey: string | null
  /** 是否需要先停当前流 */
  readonly stopFirst: boolean
  /** 打断后要执行的队首 id;null = 队列空 */
  readonly thenRun: string | null
}

/**
 * 「打断并执行」计划:先过许可门(interruptAndRun → D69 interject 族),
 * 再经 interruptPlan 出 {stopFirst, thenRun} —— 队首由调用方以既有读取路径传入,
 * 本函数不做任何队列数组操作(W27 不变式)。
 */
export function cliInterruptRunPlan(
  facts: CliQueueFacts,
  headId: string | null,
): CliInterruptRunPlan {
  const verdict = interactionAllowed('interruptAndRun', cliQueuePerms(facts))
  if (!verdict.allowed) {
    return { allowed: false, deniedKey: verdict.deniedKey, stopFirst: false, thenRun: null }
  }
  return {
    allowed: true,
    deniedKey: null,
    // interruptPlan 是唯一编排点:cli 为单流,streaming 时用稳定占位 messageId;
    // 队首 id 由调用方以既有读取路径(pending 首项)传入,本函数不触碰队列数组。
    ...interruptPlan(
      { streaming: facts.streaming, streamingMessageId: facts.streaming ? 'cli-agent-turn' : null },
      headId === null ? null : { id: headId },
    ),
  }
}

/** 模式解析:用户输入 → FollowUpMode;非法值 ok=false(调用方打 usage,不落脏状态) */
export function cliResolveFollowUpMode(pref: string):
  | { readonly ok: true; readonly resolution: FollowUpModeResolution }
  | { readonly ok: false } {
  if (!isFollowUpMode(pref)) return { ok: false }
  // cli runtimeSupport 恒 true ⇒ effectiveMode 不可能降级;仍走共享判定而非端内 if,
  // 保证降级语义若真相源变化(如未来接入远端 Runtime)本端自动跟随。
  return { ok: true, resolution: effectiveMode(pref, true) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
