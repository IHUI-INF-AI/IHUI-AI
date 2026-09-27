// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DoomLoopDetector — CLI 侧平台适配器(V3 #54,2026-09-28 抽共享层)。
 *
 * 唯一算法源在 `packages/shared/src/agent/doom-loop-detector.ts`(阈值、窗口、
 * 触发条件、状态机、换策略动作集合都在那一份里)。本文件只做两件事:
 *   1. 注入 CLI 平台的 SHA-256 摘要(node:crypto)—— 共享层禁止 import node 内建;
 *   2. 把共享层的纯事实(DoomLoopCallFact)组合成面向用户的 alert 文案。
 * 数字一律从共享层 import,不在此重抄(由守门 scripts/check-doom-loop-parity.mjs 钉死)。
 *
 * Python 等价实现:apps/ai-service/app/core/doom_loop.py(agent_loop_v2 主链路消费)。
 */

import { createHash } from 'node:crypto'

import {
  createDoomLoopWindow,
  createStuckSignatureDetector,
  stableSerializeSafe,
  DOOM_LOOP_HASH_ALGORITHM,
  type DoomLoopCallFact,
  type DoomLoopWindowStats,
  type ToolCallSignatureInput,
} from '@ihui/shared/utils/doom-loop-detector'

// 阈值/动作/状态/纯决策函数从共享层透传出去,调用方(commands/agent.ts)只认这一个入口。
export {
  DOOM_LOOP_COOLDOWN_MS,
  DOOM_LOOP_HASH_ALGORITHM,
  DOOM_LOOP_STATES,
  DOOM_LOOP_STRATEGY_ACTIONS,
  DOOM_LOOP_WINDOW_SIZE,
  DOOM_LOOP_REPEAT_THRESHOLD,
  DOOM_ALERT_ROUNDS_TO_TERMINATE,
  STUCK_CONSECUTIVE_THRESHOLD,
  FAILURE_STREAK_STRATEGY_THRESHOLD,
  ERROR_SIGNATURE_MAX_LEN,
  createFailureStreakTracker,
  planDoomAlertResponse,
  type DoomLoopState,
  type DoomLoopStrategyAction,
} from '@ihui/shared/utils/doom-loop-detector'

export interface ToolCall {
  toolName: string
  inputHash: string
}

export interface DoomLoopAlert {
  toolName: string
  inputHash: string
  repeatCount: number
  message: string
  suggestion: string
}

/**
 * 工具入参 → SHA-256 摘要(64 位小写十六进制,定长)。
 * 摘要算法与规范化序列化都取自共享层(DOOM_LOOP_HASH_ALGORITHM + stableSerializeSafe):
 * 键序无关、循环引用/BigInt/undefined 不抛错、返回值绝不含入参原文
 * (明文曾随 pattern POST 落库,2026-09-27 修)。
 */
export function hashInput(input: unknown): string {
  return createHash(DOOM_LOOP_HASH_ALGORITHM)
    .update(stableSerializeSafe(input), 'utf8')
    .digest('hex')
}

/**
 * CLI 滑动窗口检测器:内部委托共享层 createDoomLoopWindow,
 * 只负责「算摘要 + 组合用户文案」。判据/阈值全部在共享层。
 */
export class DoomLoopDetector {
  private readonly window = createDoomLoopWindow()

  record(toolName: string, input: unknown): DoomLoopAlert | null {
    const fact: DoomLoopCallFact | null = this.window.record(toolName, hashInput(input))
    if (!fact) return null
    return {
      toolName: fact.toolName,
      inputHash: fact.inputHash,
      repeatCount: fact.repeatCount,
      message: `检测到工具 ${fact.toolName} 连续调用 ${fact.repeatCount} 次相同参数,可能陷入死循环。`,
      suggestion: `请检查工具返回值,或换用其他工具/方法。`,
    }
  }

  reset(): void {
    this.window.reset()
  }

  getStats(): DoomLoopWindowStats {
    return this.window.getStats()
  }
}

/**
 * CLI stuck 检测器适配器:对 agent.ts 暴露与旧 ConsecutiveSignatureDetector 同名同形的方法
 * (recordError / recordToolCalls / isDoomLoop / reset),内部委托共享层 stuck 检测器。
 * 保留 isDoomLoop() 命名以兼容既有调用方;阈值不再本地抄,来自共享层。
 */
export class DoomLoopSignatureDetector {
  private readonly detector = createStuckSignatureDetector()

  recordError(errMsg: string): void {
    this.detector.recordError(errMsg)
  }

  recordToolCalls(
    toolCalls: ReadonlyArray<{ name: string; arguments: Record<string, unknown> }>,
  ): void {
    const sigs: ToolCallSignatureInput[] = toolCalls.map((tc) => ({
      name: tc.name,
      argsHash: hashInput(tc.arguments),
    }))
    this.detector.recordToolCallRound(sigs)
  }

  isDoomLoop(): boolean {
    return this.detector.isStuck()
  }

  reset(): void {
    this.detector.reset()
  }
}
