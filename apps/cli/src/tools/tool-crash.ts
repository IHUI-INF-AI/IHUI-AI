// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 工具执行崩溃的折法(P0 并发韧性,2026-11-27)。
 *
 * 为什么存在:并发批次走 `Promise.all`(`tool-call-scheduler.ts`),任一 worker reject 会让
 * **同批其余结果与后续批次全部作废**。工具内部真抛异常(而不是返回 `success:false`)时,
 * 必须折成"这一枚失败"的结果对象,让同批其余照跑、后续批次继续。
 *
 * 口径:
 *  - `errorType: 'tool_crashed'` **不是**可重试档(`isRetryableErrorType` 闭集只认
 *    network/timeout/rate_limited):崩溃是工具自身缺陷,换参重试无意义,与 timeout 区分开;
 *  - `output` 恒空串:崩溃没有产出,不得拿错误文案冒充产出;
 *  - 文案保留原始 message:排障要原文,不得只写"执行失败"。
 */
import type { ToolResult } from './index.js'

/** 最小入参:只依赖工具名,不把整条 ParsedToolCall 绑进来(便于单测)。 */
export interface ToolCrashCallRef {
  name: string
}

/** 把任意抛出的异常折成该枚工具的失败结果。 */
export function toolCrashResult(
  call: ToolCrashCallRef,
  error: unknown,
): ToolResult {
  const message = error instanceof Error ? error.message : String(error)
  return {
    success: false,
    output: '',
    error: `工具 ${call.name} 执行异常: ${message}`,
    errorType: 'tool_crashed',
  }
}
