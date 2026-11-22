// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 评测驱动层：用真实 `runToolLoop` 跑一个回合，外部世界全部由夹具接管。
 *
 * 被真实执行的（不是重实现）：
 *  - 流解析 / 工具调用识别 / 工具参数校验 / 工具执行 / 循环终止判定（apps/cli/src/commands/agent.ts）
 *  - 内置工具本体（apps/cli/src/tools/builtins.ts）
 * 被替换的（与能力评测无关的不确定源）：
 *  - 模型输出 → `replay.ts` 的录制回放（结构上禁止访问外网）
 *  - 用户配置 → 测试文件用 `vi.mock` 接 `settings-state.ts`，用例显式声明配置组合
 *  - 审计上报 / 埋点 → 测试文件 mock 掉（评测不验证审计，也不允许任何网络副作用）
 */
import { vi } from 'vitest'

import {
  runToolLoop,
  type RunToolLoopOptions,
  type RunToolLoopResult,
} from '@cli/commands/agent.js'
import { BUILTIN_TOOLS } from '@cli/tools/builtins.js'
import { clearTools, registerTools, resetRateLimiter } from '@cli/tools/index.js'

import { metricDirection } from './metrics.js'
import { EVAL_BASE_URL, createReplayFetch, type ReplayRecording } from './replay.js'
import { setEvalSettings } from './settings-state.js'
import type { Capability, CaseResult, MetricValue } from './types.js'

/** 评测基线配置：本地回放 provider，不携带任何真实凭据 */
export const EVAL_BASE_SETTINGS: Record<string, unknown> = {
  provider: 'ollama',
  providerBaseUrl: EVAL_BASE_URL,
  nativeFunctionCalling: true,
  // 压缩只由压缩专项用例显式开启；其它能力用例的上下文必须保持稳定，避免"顺手压缩"改变输入
  compactionV2: { enabled: false },
}

export interface EvalMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export interface TurnSpec {
  caseId: string
  workspacePath: string
  messages: EvalMessage[]
  recording: ReplayRecording
  maxIterations?: number
  /** 覆盖评测基线配置（只影响 settings 读取面） */
  settings?: Record<string, unknown>
  /** 透传给 runToolLoop 的额外选项（如 compactContext 注入点） */
  options?: Partial<RunToolLoopOptions>
}

export interface ToolCallRecord {
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResultRecord {
  name: string
  success: boolean
  output: string
}

export interface TurnOutcome {
  result: RunToolLoopResult
  /** 循环结束后 messages 的最终形态（runToolLoop 原地追加） */
  messages: EvalMessage[]
  toolCalls: ToolCallRecord[]
  toolResults: ToolResultRecord[]
  /** 每次模型调用实际发出的请求体（messages/tools 演化证据） */
  requests: Array<Record<string, unknown>>
  servedCalls: string[]
  /** 回合期间 stderr 全文（仅供本地排障，不进入快照） */
  stderr: string
}

export async function runTurn(spec: TurnSpec): Promise<TurnOutcome> {
  // 限流器是进程级滑动窗口（`apps/cli/src/tools/index.ts` 的 10s/5 次），时间基准是
  // wall-clock：前一个回合的调用会挤占后一个回合的额度，且限流错误正文带动态毫秒数
  // → 换台机器/换个顺序跑都会变。它与被评测的四项能力无关，故每个回放回合起手清空，
  // 保证「同一录制 → 同一执行路径」；回合内的限流行为本身仍由真实实现决定。
  resetRateLimiter()
  clearTools()
  registerTools(BUILTIN_TOOLS)
  setEvalSettings({ ...EVAL_BASE_SETTINGS, ...(spec.settings ?? {}) })

  const replay = createReplayFetch(spec.recording.calls)
  vi.stubGlobal('fetch', vi.fn(replay.fetchImpl))

  const stderrChunks: string[] = []
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrChunks.push(String(chunk))
    return true
  }) as never)

  const toolCalls: ToolCallRecord[] = []
  const toolResults: ToolResultRecord[] = []
  const messages = spec.messages.map((m) => ({ ...m }))

  try {
    const result = await runToolLoop({
      modelId: 'eval-replay',
      messages,
      ctx: { workspacePath: spec.workspacePath },
      maxIterations: spec.maxIterations ?? 8,
      onToolCall: (name, args) => {
        toolCalls.push({ name, arguments: args })
      },
      onToolResult: (name, success, output) => {
        toolResults.push({ name, success, output })
      },
      ...spec.options,
    })
    replay.assertFullyConsumed()
    return {
      result,
      messages,
      toolCalls,
      toolResults,
      requests: replay.requests,
      servedCalls: replay.served,
      stderr: stderrChunks.join(''),
    }
  } finally {
    stderrSpy.mockRestore()
    vi.unstubAllGlobals()
    clearTools()
  }
}

export interface CaseBuilder {
  /** 布尔判据：false 即记失败（断言不可放宽：直接来自可观测事实） */
  check: (label: string, ok: boolean, detail?: unknown) => void
  metric: (name: string, value: MetricValue) => void
  evidence: (key: string, value: unknown) => void
  finish: () => CaseResult
}

export function createCase(id: string, capability: Capability): CaseBuilder {
  const metrics: Record<string, MetricValue> = {}
  const evidence: Record<string, unknown> = {}
  const failures: string[] = []

  return {
    check(label, ok, detail) {
      if (ok) return
      const suffix = detail === undefined ? '' : ` | 实际: ${JSON.stringify(detail)}`
      failures.push(`${label}${suffix}`)
    },
    metric(name, value) {
      metricDirection(name)
      if (Object.hasOwn(metrics, name)) throw new Error(`用例 ${id} 重复登记指标 ${name}`)
      metrics[name] = value
    },
    evidence(key, value) {
      if (Object.hasOwn(evidence, key)) throw new Error(`用例 ${id} 重复登记证据 ${key}`)
      evidence[key] = value
    },
    finish() {
      return { id, capability, passed: failures.length === 0, metrics, evidence, failures }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
