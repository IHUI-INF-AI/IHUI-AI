// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-425(2026-10-07 拍板:抄上游)—— 输出被 max_tokens 截断时的有界续写。
 *
 * 上游参考:`apps/zcode-cli/packages/core/src/runtime/methods/turn-output-token-continuation.ts`
 * (判据、上界、续写 prompt 逐语义对齐,不是逐字拷贝 —— 我方消息面是 OpenAI 兼容的
 * `{ role, content }` 平面数组,没有上游的 queryScope 元数据,补丁用"结构性不落历史"
 * 承载同一约束:只进本轮下发视图,绝不 push 进持久历史/会话存储)。
 *
 * 三条铁律(与上游一致):
 * ① 判据:finish_reason === 'length',或 raw 家族值(OpenAI 兼容代理可能把上游原生
 *    停止原因透传成 finish_reason,故同判 max_tokens / max_output_tokens /
 *    model_context_window_exceeded —— 后者出现在**成功响应**里也算截断,不是输入超窗错误);
 * ② 有界:每个恢复段最多续写 MAX_OUTPUT_TOKEN_CONTINUATIONS 次,防"服务端持续返回
 *    截断标记"时无限烧钱;正常步(非截断收尾 / 有工具调用)即归还预算;
 * ③ 续写补丁(Output token limit hit …)是恢复机制的内部脚手架,不是用户发言,
 *    不得写进持久历史 —— 落点在 runToolLoop 的 pendingOutputContinuationPrompt。
 */

/** 续写补丁正文(与上游 OUTPUT_TOKEN_CONTINUE_PROMPT 逐字同文:指令面已在上游打磨过) */
export const OUTPUT_TOKEN_CONTINUE_PROMPT =
  'Output token limit hit. Resume directly — no apology, no recap of what you were doing. Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.';

/** 有界续写恢复段预算:每个恢复段最多 3 次(与上游 MAX_OUTPUT_TOKEN_CONTINUATIONS 同值) */
export const MAX_OUTPUT_TOKEN_CONTINUATIONS = 3;

/**
 * raw 停止原因家族:OpenAI 兼容代理(SGLite/vLLM/LiteLLM 网关等)把各上游原生值
 * 透传进 finish_reason 时可能出现;'length' 之外同判,与上游 OUTPUT_LIMIT_RAW_REASONS 同集。
 */
const OUTPUT_LIMIT_RAW_REASONS: ReadonlySet<string> = new Set([
  'max_tokens',
  'max_output_tokens',
  'model_context_window_exceeded',
]);

export type OutputTokenContinuationDecision = 'continue' | 'exhausted' | 'none';

/**
 * 该结束原因是否属于"输出被长度上限截断"。
 * 注意:finish_reason 为 undefined(provider 没发 / 远端 SSE 契约不携带)一律不算截断
 * —— 不缺判据时宁可不续写,不得误报(与 truncation-visible-notice 的"不喊"同口径)。
 */
export function isOutputTokenLimitFinishReason(finishReason: string | undefined | null): boolean {
  return finishReason === 'length' || OUTPUT_LIMIT_RAW_REASONS.has(finishReason ?? '');
}

/**
 * 续写裁决(与上游 classifyOutputTokenContinuation 同形态,rawFinishReason 入参省略 ——
 * 我方 provider 面只有 finish_reason 一个出口,raw 家族值就落在同一个字段里)。
 * - 有工具调用 ⇒ 'none':那是 turn 的正常推进(工具循环接手),不是恢复段;
 * - 非截断结束 ⇒ 'none';
 * - 截断且预算未尽 ⇒ 'continue';预算已尽 ⇒ 'exhausted'(调用方必须让用户看得见)。
 */
export function classifyOutputTokenContinuation(input: {
  finishReason: string | undefined;
  toolCallCount: number;
  continuationCount: number;
}): OutputTokenContinuationDecision {
  if (input.toolCallCount > 0) return 'none';
  if (!isOutputTokenLimitFinishReason(input.finishReason)) return 'none';
  return input.continuationCount < MAX_OUTPUT_TOKEN_CONTINUATIONS ? 'continue' : 'exhausted';
}

/** 构造续写补丁消息(只进本轮下发视图;调用方禁止把它 push 进 opts.messages) */
export function createOutputTokenContinuationMessage(): { role: 'user'; content: string } {
  return { role: 'user', content: OUTPUT_TOKEN_CONTINUE_PROMPT };
}
