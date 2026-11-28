// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 原生 function calling 的请求体构造 + 降级恢复判据(P0 两件,2026-11-27)。
 *
 * 两件事分开:
 *  ① `buildNativeToolsBody`:把已投影的 tools schema 与 `tool_choice` 组进 `extraBody`。
 *     `tool_choice` 缺省**不写**(请求体与改动前逐字节相同);只有调用方显式给值才出现,
 *     这是"声明后才生效"的同一纪律。
 *  ② `shouldRetryNativeTools`:auto 探测降级后的**定向恢复**。旧行为是探测失败一次就
 *     整会话永久降级 prompt 模式;现在降级后每满 `NATIVE_TOOLS_RETRY_INTERVAL` 轮重试一次
 *     原生(provider 能力可能随端点/模型热切换),再失败就重新计时,不放大成本。
 *
 * 为什么独立成模块:两条都要能单测(agent.ts 的循环体内联逻辑没有测试面)。
 */

/** OpenAI 兼容的 tool_choice 取值。`required` 是"必须调工具",对象形是"必须调这一枚"。 */
export type ToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } }

export interface ProviderToolSchemaLike {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
    strict?: boolean
  }
}

/** 降级后重试原生 tools 的间隔(轮)。取值理由:太小会让不支持的 provider 每轮多烧一次失败请求,太大等于永久降级。 */
export const NATIVE_TOOLS_RETRY_INTERVAL = 5

/**
 * 组 `extraBody`。空 tools ⇒ `undefined`(不携带 tools 字段,与"没有原生能力"同形)。
 * `toolChoice` 缺省 ⇒ 请求体里没有 `tool_choice`(逐字节兼容旧请求)。
 */
export function buildNativeToolsBody(
  schemas: readonly ProviderToolSchemaLike[],
  toolChoice?: ToolChoice,
  parallelToolCalls?: boolean,
): Record<string, unknown> | undefined {
  if (schemas.length === 0) return undefined
  const body: Record<string, unknown> = { tools: [...schemas] }
  if (toolChoice !== undefined) body.tool_choice = toolChoice
  if (parallelToolCalls !== undefined) body.parallel_tool_calls = parallelToolCalls
  return body
}

/**
 * 是否到了"重试原生 tools"的时机。
 * 只在**已降级**(enabled=false)且有降级轮次记录时判;间隔不足 ⇒ false(仍在降级窗口内)。
 */
export function shouldRetryNativeTools(
  enabled: boolean,
  downgradeAt: number | null,
  currentIteration: number,
): boolean {
  if (enabled) return false
  if (downgradeAt === null) return false
  return currentIteration - downgradeAt >= NATIVE_TOOLS_RETRY_INTERVAL
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
